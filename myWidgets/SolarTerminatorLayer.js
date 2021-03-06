/* 
 * SolarTerminatorLayer.js
 *
 * original code written by Jim Blaney http://www.arcgis.com/home/item.html?id=6c65b0f17ffc4bfdb71f60ca64d40bcc
 * AMDified later (by a complete numbskull)
 *
 * CODE PROVIDED AS-IS AND WITHOUT WARRANTY.
 */
 
define([
        "dojo/Evented",
        "dojo/_base/declare",
        "dijit/_WidgetBase",
        "dijit/_TemplatedMixin",
        "dojo/_base/lang",
        "dojo/_base/Color",
        "dojo/_base/connect",
		"esri/layers/GraphicsLayer",
		"esri/graphic",
		"esri/symbols/SimpleFillSymbol",
		"esri/geometry/Polygon",
		"esri/geometry/webMercatorUtils"		
	],
	function (
		Evented,
        declare,
        _WidgetBase,
        _TemplatedMixin,
        lang,
        Color,
        connect,
        GraphicsLayer,
		Graphic,
		SimpleFillSymbol,
		Polygon,
		webMercatorUtils
		) {
	var Widget = declare([_WidgetBase, _TemplatedMixin, Evented], {
			//declaredClass : "myWidgets/SolarTerminatorLayer",
			options: {
                id : null,
                dateTime : null,
                refreshIntervalMs : 5000,
                symbol : new SimpleFillSymbol("solid", null, new Color([0, 0, 0, 0.35])),
                _interval : null,
                _connects : [],
                _wkid : 4326,			
            },
            constructor: function (options) {
				// mix in settings and defaults
                var defaults = lang.mixin({}, this.options, options);
                this.set("id", defaults.id);
                this.set("dateTime", defaults.dateTime);
                this.set("refreshIntervalMs", defaults.refreshIntervalMs);
                this.set("symbol", defaults.symbol); 
                this.set("visible", defaults.visible);              
			},
            
            /*
            id : null,
			dateTime : null,
			refreshIntervalMs : 5000,
			symbol : new SimpleFillSymbol("solid", null, new Color([0, 0, 0, 0.35])),
			_interval : null,
			_connects : [],
			_wkid : 4326,
            constructor : function (args) {
				this.inherited(arguments);
				declare.safeMixin(this, args);
			},
            */
			
            
			
            // setup override 
			enableMouseEvents : function () {
				this.inherited(arguments);
				this._wkid = this._map.spatialReference.wkid;
				if (this.visible) {
					this._attachInterval();
				}
				this._connects.push(connect.connect(this._map, "onTimeExtentChange", this, this._onTimeExtentChange));
				this.refresh();
			},
            
			// teardown override 
			_unsetMap : function () {
				this.inherited(arguments);
				this._detachInterval();
				while (this._connects.length > 0) {
					connect.disconnect(this._connects.pop());
				}
			},
			// public functions 
			refresh : function () {
				this.inherited(arguments);
				this.clear();
				var geoms = this._getGeometries();
				for (var i = 0; i < geoms.length; i++) {
					this.add(new Graphic(geoms[i], this.symbol));
				}
			},
			onVisibilityChange : function (visibility) {
				this.inherited(arguments);
				if (visibility) {
					this._attachInterval();
				} else {
					this._detachInterval();
				}
			},
			// private functions 
			_attachInterval : function () {
				if (this._interval != null) {
					this._detachInterval();
				}
				this._interval = setInterval(lang.hitch(this, this.refresh), this.refreshIntervalMs);
			},
			_detachInterval : function () {
				if (this._interval != null) {
					clearInterval(this._interval);
					this._interval = null;
				}
			},
			_getDaysInMonth : function (month, year) {
				var daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
				if (month >= daysInMonth.length) {
					return 0;
				}
				if (month == 1 && new Date(year, 2 - 1, 29).getDate() == 29) {
					return 29;
				} else {
					return daysInMonth[month];
				}
			},
			_getGeometries : function () {
				var geoms = [];
				var dt = this.dateTime || new Date();
				var solarDeclination = this._getSolarDeclination(dt);
				var isWebMercator = (this._wkid === 102100 || this._wkid === 3857 || this._wkid === 102113);
				var yMax = (isWebMercator ? 85 : 90);
				var latitude = yMax * (solarDeclination > 0 ? -1 : 1);
				for (var lon = -180; lon < 180; lon++) {
					var path = [];
					path.push([lon + 1, latitude]);
					path.push([lon, latitude]);
					path.push([lon, this._getLatitude(lon, solarDeclination, dt, -yMax, yMax)]);
					path.push([lon + 1, this._getLatitude(lon + 1, solarDeclination, dt, -yMax, yMax)]);
					path.push([lon + 1, latitude]);
					geoms.push(new Polygon({
							rings : [path],
							spatialReference : {
								wkid : 4326
							}
						}));
				}
				if (isWebMercator) {
					for (var i = 0; i < geoms.length; i++) {
						geoms[i] = webMercatorUtils.geographicToWebMercator(geoms[i]);
					}
				}
				return geoms;
			},
			_getLatitude : function (longitude, solarDeclination, dt, yMin, yMax) {
				var K = Math.PI / 180;
				var lt = dt.getUTCHours() + dt.getUTCMinutes() / 60 + dt.getUTCSeconds() / 3600;
				var tau = 15 * (lt - 12);
				longitude += tau;
				var tanLat = -Math.cos(longitude * K) / Math.tan(solarDeclination * K);
				var arctanLat = Math.atan(tanLat) / K;
				return Math.max(Math.min(arctanLat, yMax), yMin);
			},
			_getOrdinalDay : function (dt) {
				var ordinalDay = 0;
				for (var i = 0; i < dt.getMonth(); i++) {
					ordinalDay += this._getDaysInMonth(i);
				}
				ordinalDay += dt.getDate();
				return ordinalDay;
			},
			_getSolarDeclination : function (dt) { // http://en.wikipedia.org/wiki/Declination
				dt = dt || new Date();
				var ordinalDay = this._getOrdinalDay(dt);
				return -57.295779 * Math.asin(0.397788 * Math.cos(0.017203 * (ordinalDay + 10) + 0.052465 * Math.sin(0.017203 * (ordinalDay - 2))));
			},
			_getSolarDeclinationApprox : function (dt) { // not used // http://en.wikipedia.org/wiki/Declination
				dt = dt || new Date();
				return -Math.abs(23.44 * Math.cos((this._getOrdinalDay(dt) - 1 + 10) * ((2 * Math.PI) / 365.25)));
			},
			_onTimeExtentChange : function (timeExtent) {
				this.dateTime = timeExtent.endTime || timeExtent.startTime;
				this.refresh();
			}
		});
});