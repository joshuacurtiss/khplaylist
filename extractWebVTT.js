// extractWebVTT will receive a video file and use mplayer to retrieve
// chaper information. It then converts the output from mplayer into a
// valid WebVTT format and saves it as a file with same name/path with 
// extension .webvtt! 

// Dependencies
const fs=require("fs");
const moment=require("moment");
require("moment-duration-format");
const exec=require('child_process').exec;

// Time/Chapter Stuff
const re=/^ID_CHAPTER_(\d{1,5})_(start|end|name)=(.*)$/gim;
const TIMEFMT="HH:mm:ss.SSS";
const TIMEOPTS={forceLength:true, trim:false};
function timeFormat(dur){return moment.duration(parseInt(dur)).format(TIMEFMT,TIMEOPTS)}

// Variables
var match, data={}, webvtt="WEBVTT FILE", ch, chdata;
var videoFilePath=process.argv[2];

// Run then process the mplayer results
var mplayerOutput=exec(`mplayer -vo null -ao null -identify -frames 0 ${videoFilePath}`,(err,stdout,stderr)=>{
    if( err ) {
        console.error(stderr);
    } else {
        // Build a map by finding all matches in mplayer's info output
        while( match=re.exec(mplayerOutput) ) {
            if( !data[match[1]] ) data[match[1]]={};
            data[match[1]][match[2].toLowerCase()]=match[3];
        }
        // Loop through the chapters and builds the WebVTT
        for( ch in data ) {
            chdata=data[ch];
            webvtt+=`\n\n${ch}`;
            webvtt+=`\n${moment.duration(parseInt(chdata.start)).format(TIMEFMT,TIMEOPTS)} --> `;
            webvtt+=`${moment.duration(parseInt(chdata.end)).format(TIMEFMT,TIMEOPTS)}`;
            webvtt+=`\n${chdata.name}`;
        }
        // Save the WebVTT file.
        var webvttpath=videoFilePath+".webvtt";
        fs.writeFileSync(webvttpath, webvtt);
    }
})
