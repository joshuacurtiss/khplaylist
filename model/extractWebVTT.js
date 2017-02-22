// extractWebVTT will receive a video file and use mplayer to retrieve
// chaper information. It then converts the output from mplayer into a
// valid WebVTT format using the WebVTT object, and saves it as a file
// with same name/path with extension .webvtt! 

// Dependencies
const WebVTT=require("./WebVTT");
const fs=require("fs");
const exec=require('child_process').exec;

// RegEx for finding the start/end/name data in mplayer output
const re=/^ID_CHAPTER_(\d{1,5})_(start|end|name)=(.*)$/gim;

// Variables
var match, data={};
var videoFilePath=process.argv[2];

// Run then process the mplayer results
exec(`mplayer -vo null -ao null -identify -frames 0 ${videoFilePath}`,(err,stdout,stderr)=>{
    if( err ) {
        console.error(stderr);
    } else {
        // Build a map by finding all matches in mplayer's info output
        while( match=re.exec(stdout) ) {
            var id=match[1],
                key=match[2].toLowerCase(),
                value=match[3];
            if( !data[id] ) data[id]={id:id};
            if( key=="start" || key=="end" ) value=parseFloat(value)/1000;
            data[id][key]=value;
        }
        // Convert the map to a list
        var arr=[];
        for( var objkey in data ) {arr.push(data[objkey])}
        // Put the data into WebVTT object
        var webvtt=new WebVTT(arr);
        // Save the WebVTT file.
        var webvttpath=videoFilePath+".webvtt";
        fs.writeFileSync(webvttpath, webvtt.toString());
        console.log(webvtt.toString());
    }
})
