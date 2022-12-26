
/**
 * Based on elgato plugin template and kirupa clock tutorial.
 * Tutorial link https://www.kirupa.com/html5/create_an_analog_clock_using_the_canvas.htm
 */

/* global $CC, Utils, $SD */

/**
 * Here are a couple of wrappers we created to help you quickly setup
 * your plugin and subscribe to events sent by Stream Deck to your plugin.
 */

/**
 * The 'connected' event is sent to your plugin, after the plugin's instance
 * is registered with Stream Deck software. It carries the current websocket
 * and other information about the current environmet in a JSON object
 * You can use it to subscribe to events you want to use in your plugin.
 */

$SD.on('connected', (jsonObj) => connected(jsonObj));

var gDotColor = "#bf0000"
var gDotInactiveColor = "#888888"
var gBackgroundColor = "#000000"

const gDotColorDefault = "#bf0000"
const gDotInactiveColorDefault = "#888888"
const gBackgroundColorDefault = "#000000"

var allElements = []

/**
 * Data Structure of allElements
 * [ 
 *      {
 *          context: jsn.context,
 *          dotColor: "",
 *          inactiveColor: "",
 *          backgroundColor: "",
 *          timer: <object>
 *      }
 * ]
 * 
 */

function connected(jsn) {
    // Subscribe to the willAppear and other events
    $SD.on('fail.marc.onairclock.action.willAppear', (jsonObj) => action.onWillAppear(jsonObj));
    $SD.on('fail.marc.onairclock.action.willDisappear', jsonObj => action.onWillDisappear(jsonObj));
    $SD.on('fail.marc.onairclock.action.keyUp', (jsonObj) => action.onKeyUp(jsonObj));
    $SD.on('fail.marc.onairclock.action.sendToPlugin', (jsonObj) => action.onSendToPlugin(jsonObj));
    $SD.on('fail.marc.onairclock.action.didReceiveSettings', (jsonObj) => action.onDidReceiveSettings(jsonObj));
    $SD.on('fail.marc.onairclock.action.propertyInspectorDidAppear', (jsonObj) => {
        console.log('%c%s', 'color: white; background: black; font-size: 13px;', '[app.js]propertyInspectorDidAppear:');
    });
    $SD.on('fail.marc.onairclock.action.propertyInspectorDidDisappear', (jsonObj) => {
        console.log('%c%s', 'color: white; background: red; font-size: 13px;', '[app.js]propertyInspectorDidDisappear:');
        // destroyClock(jsonObj)
    });
};

// ACTIONS
const action = {
    settings:{},
    onDidReceiveSettings: function(jsn) {
        console.log('%c%s', 'color: white; background: red; font-size: 15px;', '[app.js]onDidReceiveSettings:');
        console.log(jsn)
        // this.settings = Utils.getProp(jsn, 'payload.settings', {});
        // this.doSomeThing(this.settings, 'onDidReceiveSettings', 'orange');

        /**
         * In this example we put a HTML-input element with id='mynameinput'
         * into the Property Inspector's DOM. If you enter some data into that
         * input-field it get's saved to Stream Deck persistently and the plugin
         * will receive the updated 'didReceiveSettings' event.
         * Here we look for this setting and use it to change the title of
         * the key.
         */

        //  this.setTitle(jsn);
        // if (isHexColor(jsn.payload.settings.dotcolor) == true) {
        //     console.log("dotcolor is hex")
        //     gDotColor = jsn.payload.settings.dotcolor
        // }
        // if (isHexColor(jsn.payload.settings.inactivecolor) == true) {
        //     console.log("dotcolor is hex")
        //     gDotInactiveColor = jsn.payload.settings.inactivecolor
        // }
        // if (isHexColor(jsn.payload.settings.backgroundcolor) == true) {
        //     console.log("dotcolor is hex")
        //     gBackgroundColor = jsn.payload.settings.backgroundcolor
        // }
        // const clock = new drawClockImg(jsn)
        updateClock(jsn)

    },

    /** 
     * The 'willAppear' event is the first event a key will receive, right before it gets
     * shown on your Stream Deck and/or in Stream Deck software.
     * This event is a good place to setup your plugin and look at current settings (if any),
     * which are embedded in the events payload.
     */

    onWillAppear: function (jsn) {
        console.log("You can cache your settings in 'onWillAppear'", jsn.payload.settings);
        /**
         * The willAppear event carries your saved settings (if any). You can use these settings
         * to setup your plugin or save the settings for later use. 
         * If you want to request settings at a later time, you can do so using the
         * 'getSettings' event, which will tell Stream Deck to send your data 
         * (in the 'didReceiveSettings above)
         * 
         * $SD.api.getSettings(jsn.context);
        */

        if(!jsn.payload || !jsn.payload.hasOwnProperty('settings')) return;
        this.settings = jsn.payload.settings;

        console.log("did load. Context: ")
        console.log(jsn.context)

        // Nothing in the settings pre-fill, just something for demonstration purposes
        if (!this.settings || Object.keys(this.settings).length === 0) {
            this.settings.mynameinput = 'TEMPLATE';
        }
        // this.setTitle(jsn);
        // init with correct settings

        updateClock(jsn)


        // jsn.intervalID = new createClock(jsn);

        // console.log("interval, context ")
        // console.log(jsn.intervalID)
        // console.log(jsn.context)

        // this.cache[jsn.intervalID] = jsn.intervalID;
        this.onDidReceiveSettings(jsn);

    },

    onWillDisappear: function (jsn) {

        destroyClock(jsn)

    },

    onKeyUp: function (jsn) {
        this.doSomeThing(jsn, 'onKeyUp', 'green');
    },

    onSendToPlugin: function (jsn) {
        /**
         * This is a message sent directly from the Property Inspector 
         * (e.g. some value, which is not saved to settings) 
         * You can send this event from Property Inspector (see there for an example)
         */ 

        // const sdpi_collection = Utils.getProp(jsn, 'payload.sdpi_collection', {});
        // if (sdpi_collection.value && sdpi_collection.value !== undefined) {
        //     this.doSomeThing({ [sdpi_collection.key] : sdpi_collection.value }, 'onSendToPlugin', 'fuchsia');            
        // }
    },

    /**
     * This snippet shows how you could save settings persistantly to Stream Deck software.
     * It is not used in this example plugin.
     */

    saveSettings: function (jsn, sdpi_collection) {
        console.log('saveSettings:', jsn);
        // if (sdpi_collection.hasOwnProperty('key') && sdpi_collection.key != '') {
        //     if (sdpi_collection.value && sdpi_collection.value !== undefined) {
        //         this.settings[sdpi_collection.key] = sdpi_collection.value;
        //         console.log('setSettings....', this.settings);
        //         $SD.api.setSettings(jsn.context, this.settings);
        //     }
        // }
    },

    /**
     * Here's a quick demo-wrapper to show how you could change a key's title based on what you
     * stored in settings.
     * If you enter something into Property Inspector's name field (in this demo),
     * it will get the title of your key.
     * 
     * @param {JSON} jsn // The JSON object passed from Stream Deck to the plugin, which contains the plugin's context
     * 
     */

    setTitle: function(jsn) {
        // if (this.settings && this.settings.hasOwnProperty('mynameinput')) {
        //     console.log("watch the key on your StreamDeck - it got a new title...", this.settings.mynameinput);
        //     $SD.api.setTitle(jsn.context, this.settings.mynameinput);
        // }
    },

    /**
     * Finally here's a method which gets called from various events above.
     * This is just an idea on how you can act on receiving some interesting message
     * from Stream Deck.
     */

    doSomeThing: function(inJsonData, caller, tagColor) {
        console.log('%c%s', `color: white; background: ${tagColor || 'grey'}; font-size: 15px;`, `[app.js]doSomeThing from: ${caller}`);
        // console.log(inJsonData);
    }, 


};

function updateClock(jsn) {

    var currentElement = {}

    if(allElements.some(item => item.context === jsn.context) == true) {
        // update settings
        currentElement = allElements.find(item => item.context === jsn.context)

        currentElement.dotColor = isHexColor(jsn.payload.settings.dotcolor) ? jsn.payload.settings.dotcolor : gDotColorDefault;
        currentElement.inactiveColor = isHexColor(jsn.payload.settings.inactivecolor) ? jsn.payload.settings.inactivecolor : gDotInactiveColorDefault;
        currentElement.backgroundColor = isHexColor(jsn.payload.settings.backgroundcolor) ? jsn.payload.settings.backgroundcolor : gBackgroundColorDefault;

        console.log(currentElement)
    } else {
        // create new entry, populate with data, setup timer

        currentElement.context = jsn.context
        
        currentElement.dotColor = isHexColor(jsn.payload.settings.dotcolor) ? jsn.payload.settings.dotcolor : gDotColorDefault;
        currentElement.inactiveColor = isHexColor(jsn.payload.settings.inactivecolor) ? jsn.payload.settings.inactivecolor : gDotInactiveColorDefault;
        currentElement.backgroundColor = isHexColor(jsn.payload.settings.backgroundcolor) ? jsn.payload.settings.backgroundcolor : gBackgroundColorDefault;

        currentElement.timer = setInterval(function(sx) {
            drawClockImg(jsn)
        }, 1000);

        allElements.push(currentElement)
    }


}
function destroyClock(jsn) {
    console.log("destroying")
    var currentElement = {}
    if(allElements.some(item => item.context === jsn.context) == true) {
        console.log("destroying elem timer")
        currentElement = allElements.find(item => item.context === jsn.context)
        console.log(currentElement.timer)
        clearInterval(currentElement.timer)

        const index = allElements.indexOf(currentElement)
        allElements.splice(index, 1)
        console.log("deleted element" + index )
        console.log(allElements)

    }

}

function drawClockImg(jsn) {
    // var context = jsn.context
    // var clockID = 0

    var canvas = document.createElement('canvas');
    canvas.id = jsn.context;
    // console.log(canvas.id)
    canvas.width = 144;
    canvas.height = 144;
    displayTime(canvas, jsn)
    var imgData = canvas.toDataURL();

    // console.log(canvas)
    $SD.api.setImage(
        jsn.context,
        imgData
    );

}


function displayTime(canvas, jsn) {
    console.log("displayTime jsn:")
    console.log(jsn)

    console.log(allElements)
    var currentElement = {}
    // we only care about the jsn.context here and read everything else from our allElements storage.
    if(allElements.some(item => item.context === jsn.context) == true) {
        // update settings
        console.log("found current context in global storage")
        currentElement = allElements.find(item => item.context === jsn.context)
    }

    var now = new Date();
    var h = now.getHours();
    var m = now.getMinutes();
    var s = now.getSeconds();
    var month = now.getMonth();
    month = month + 1
    var day = now.getDate();
     
    // var timeString = formatHour(h) + ":" + padZero(m) + ":" + padZero(s) + " " + getTimePeriod(h);
    // document.querySelector("#current-time").innerHTML = timeString;
     
    // --- On-Air clock ---//
    // var canvas = document.querySelector("#clock");
    var context = canvas.getContext("2d");
     
    var clockRadius = 166 / 2;
     
    // Make sure the clock is centered in the canvas
    var clockX = canvas.width / 2;
    var clockY = canvas.height / 2;
     
    // Make sure TAU is defined (it's not by default)
    Math.TAU = 2 * Math.PI;

    function drawScale(s, circleDiameter, dotThickness, dotInactiveThickness, dotColor, dotInactiveColor, backgroundColor) {
        const dotGrid = 60
        const hourGrid = 12
        
        context.clearRect(0, 0, canvas.width, canvas.height);
        // console.log("draw operation")
        var targetX = 0
        var targetY = 0
        context.fillStyle = backgroundColor;
        context.fillRect(0,0,canvas.width,canvas.height);


        // ToDo cleanup, make drawDots function


        // Draw second dots first
        for(var i=0; i < ( s + 1 ); i++){
            var dotRadians = (Math.TAU * i/dotGrid) - (Math.TAU/4);

            var targetX = clockX + Math.cos(dotRadians) * (circleDiameter * clockRadius);
            var targetY = clockY + Math.sin(dotRadians) * (circleDiameter * clockRadius);

            // context.fillRect(targetX,targetY,3,3);
            context.fillStyle = dotColor;
            context.beginPath();
            context.arc(targetX, targetY, dotThickness, 0, 2 * Math.PI, true);
            context.fill();
        }
        // draw dots inactive
        for(var j=i; j < dotGrid; j++){
            var dotRadians = (Math.TAU * j/dotGrid) - (Math.TAU/4);

            var targetX = clockX + Math.cos(dotRadians) * (circleDiameter * clockRadius);
            var targetY = clockY + Math.sin(dotRadians) * (circleDiameter * clockRadius);


            context.fillStyle = dotInactiveColor;
            context.beginPath();
            context.arc(targetX, targetY, dotInactiveThickness, 0, 2 * Math.PI, true);
            context.fill();
        }
        // draw hour marks
        for(var k=0; k < hourGrid; k++){
            var dotRadians = (Math.TAU * k/hourGrid) - (Math.TAU/4);
            // console.log(circleDiameter)
            var targetX = clockX + Math.cos(dotRadians) * ((circleDiameter - 0.08) * clockRadius);
            var targetY = clockY + Math.sin(dotRadians) * ((circleDiameter - 0.08) * clockRadius);

            context.fillStyle = dotInactiveColor;
            context.beginPath();
            context.arc(targetX, targetY, dotThickness, 0, 2 * Math.PI, true);
            context.fill();
        }
        // draw 0
        var dotRadians = (Math.TAU * 0/hourGrid) - (Math.TAU/4);
        // console.log(circleDiameter)
        var targetX = clockX + Math.cos(dotRadians) * ((circleDiameter - 0.08) * clockRadius);
        var targetY = clockY + Math.sin(dotRadians) * ((circleDiameter - 0.08) * clockRadius);

        context.fillStyle = dotInactiveColor;
        context.beginPath();
        context.arc(targetX, targetY, dotThickness + 0.5, 0, 2 * Math.PI, true);
        context.fill();

        // draw time with seconds 
        // context.font = "20px Verdana";
        // context.textAlign = "center";
        // context.fillStyle = dotColor;
        // context.fillText(padZero(h) + ":" + padZero(m) + ":" + padZero(s), clockX, (clockY + 10));

        // draw time without seconds
        context.font = "30px Verdana";
        context.textAlign = "center";
        context.fillStyle = dotColor;
        context.fillText(padZero(h) + ":" + padZero(m), clockX, (clockY + 10));

        // draw seconds in second line
        context.font = "22px Verdana";
        context.textAlign = "center";
        context.fillStyle = dotColor;
        context.fillText(padZero(s), clockX, (clockY + 35));

                // draw date
                context.font = "14px Verdana";
                context.textAlign = "center";
                context.fillStyle = dotColor;
                context.fillText(day + "-" + month, clockX, (clockY - 27));

    }
    // drawScale(s, circleDiameter, dotThickness, dotInactiveThickness, dotColor, dotInactiveColor) 
    drawScale(s, 0.8, 2.2, 1.4, currentElement.dotColor, currentElement.inactiveColor, currentElement.backgroundColor)


    function padZero(num) {
        if (num < 10) { 
            return "0" + String(num);
        }
        else {
            return String(num);
        }
    }
    function formatHour(h) {
        var hour = h % 12;
     
        if (hour == 0) { 
            hour = 12; 
        }
         
        return String(hour)
    }
    
    function getTimePeriod(h) {
        return (h < 12) ? "AM" : "PM"; 
    }

}



function isHexColor(color) {
    const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    return hexColorRegex.test(color);
  }