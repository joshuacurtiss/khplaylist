/*
 *      This dev script loads the library of video files and uses their cues to calculate
 *      the number of chapters and verses in each Bible book.
 */

// Libraries 
const fs=require("fs-extra");
const os=require("os");
const path=require("path");
const BibleBook=require('../bower_components/scripture/BibleBook');
const ScriptureUtil=require('../bower_components/scripture/ScriptureUtil');
const ScriptureVideoUtil=require('../model/ScriptureVideoUtil');
const ScriptureVideo=require('../model/ScriptureVideo');
const Scripture=require('../bower_components/scripture/Scripture');
const WebvttCacheManager=require("../model/WebvttCacheManager");
const WebVttWrapperController=require("../bower_components/webvtt/wrappers/WrapperController");

// Init
var videopaths=[path.join(os.homedir(),os.type()=="Windows_NT"?"Videos":"Movies")];
var videoAppController=new WebVttWrapperController({ffprobe:path.join('..',"bin","ffprobe"+(os.type()=="Windows_NT"?".exe":""))});
var cachedir=path.normalize('webvttcache');
fs.ensureDirSync(cachedir);
var cachemgr=new WebvttCacheManager({internalCacheDir:cachedir});
var svu=new ScriptureVideoUtil(videopaths, videoAppController, cachemgr);

// Handles processing a given book/chapter
function process(scrip,data) {
    let key=scrip.book.name;
    let ch=scrip.chapter;
    // Just ask the scripture video util to return a scripture video object.
    // Then we can ask the object for webvtt data and look at the cues.
    svu.createVideo(scrip,(err,vid)=>{
        if( !err ) {
            // Filter out cues that are footnotes and whatnot
            let goodcues=vid.webvtt.data.filter(cue=>{
                var verse=cue.content.substr(cue.content.indexOf(":")+1);
                return cue.content.substr(0,1)!=="*" && /^\d+$/.test(verse);
            });
            // Acquire the verse
            let content=goodcues[goodcues.length-1].content;
            var verse=Number(content.substr(content.indexOf(":")+1));
            // Only store if we found a valid verse
            if( Number.isInteger(verse) ) 
                data[key][ch-1]=verse;
        }
        // Keep track of how many chapters are asynchronously being processed
        chCnt--;
    });
}

function report() {
    // Once all chapters are done processing, generate report
    if( chCnt<=0 ) {
        console.log(`\n\n     ***** REPORT *****     \n\n`);
        Object.keys(data).forEach(book=>{
            if( data[book].findIndex(ch=>ch>0)>=0 ) {
                console.log(`${book}=[${data[book].join(',')}]`);
            }
        });
    } else {
        setTimeout(report, 250);
    }
}

// OK, here we go! Loop thru all Bible books and check for chapters 1-150. 
var data={}, chCnt=0;
ScriptureUtil.BIBLEBOOKS.forEach(book=>{
    data[book.name]=new Array(150);
    var bookarray=data[book.name];
    var foundVerses=false;
    // For simplicity, only handle books with chapters.
    if( book.hasChapters ) {
        // Go in reverse to trim unfound chapters at same time
        for( var ch=150 ; ch>0 ; ch-- ) {
            let scrip=new Scripture(book,ch,1);
            if( scrip.valid() ) {
                process(scrip,data);
                chCnt++;
            }
            if( bookarray[ch-1]==null && ! foundVerses ) bookarray.splice(ch-1);
            else foundVerses=true;
        }
    }
});
report();
