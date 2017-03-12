// Link to main process
const electron=require("electron");
const main=electron.remote.require("./main.js");

// Dependencies
const os=require("os");
const path=require("path");
const fs=require("fs-extra");
const WebVttWrapperController=require("../bower_components/webvtt/wrappers/WrapperController");
const Scripture=require("../bower_components/scripture/Scripture");
const ScriptureUtil=require("../bower_components/scripture/ScriptureUtil");
const ScriptureVideoUtil=require("../model/ScriptureVideoUtil");
const jQuery=$=require("../bower_components/jquery/dist/jquery");
require("../bower_components/jquery-ui/jquery-ui");

// Globals
const PLAYLISTITEM_CLASSES="mediaErr parseErr parsing new valid";
var video, $curTime, $chname;
var videopath=os.homedir()+path.sep+(os.type()=="Darwin"?"Movies":"Videos");
var svu=new ScriptureVideoUtil(videopath);
var su=new ScriptureUtil();
var videoAppController=new WebVttWrapperController()

$(document).ready(()=>{
    console.log("Hello!");
    video=document.getElementById("video");
    $curTime=$(".curTime");
    $chname=$(".chname");

    // Wire up listeners
    $(window).keydown(windowKeyDownHandler);
    $(window).keyup(windowKeyUpHandler);
    video.addEventListener("timeupdate", checkVideo, false);
    video.addEventListener("timeupdate", updateVideoUI, false);
    video.addEventListener("click", toggleVideo, false);
    $(".fullscreenToggle").click(toggleFullscreen);
    $(".powerButton").click(quit);
    $(".vidbackward").click(prevVideo);
    $(".vidforward").click(nextVideo);
    $(".vidplaypause").click(toggleVideo);

    // Mouse movement handler (for fullscreen mode)
    var uiTimeout, uiStatus=false;
    $(window).mousemove(()=>{
        var currentStatus=uiStatus;
        uiStatus=true;
        if( ! currentStatus ) $(".fullscreenMode.ui").animate({"opacity":0.8},400);
        if(uiTimeout) clearTimeout(uiTimeout);
        uiTimeout=setTimeout(()=>{
            $(".fullscreenMode.ui").animate({"opacity":0},400,()=>{uiStatus=false});
        },2000);
    });

    // Set up and restore playlist state
    addPlaylistRow();
    loadState();
    
    // Playlist sortability
    $("#playlist ol").sortable({
        axis: "y",
        cursor: "-webkit-grabbing",
        handle: ".handle",
        opacity: 0.7,
        revert: true
    });
    
    // Select first entry
    selectFirstItem();

    // Done!
    console.log("Initialized!");
});

function selectFirstItem(){
    var $firstli=$("#playlist li:first");
    if( $firstli.hasClass("parsing") ) setTimeout(selectFirstItem,100);
    else selectPlaylistItem($firstli);
}

function loadState() {
    var state;
    try {
        state=require("../data/state");
    } catch(e) {
        console.log("Error loading state. Using defaults.");
        state=require("../data/default");
    } 
    $('body').removeClass('fullscreenMode playlistMode').addClass(state.mode);
    for( var item of state.playlist ) {
        var $li=$("#playlist li:last");
        var $input=$li.find("input");
        $input.val(item.text);
        parsePlaylistItem($input);
        addPlaylistRow($li);
    }
}

function saveState() {
    var list=[];
    $("#playlist li").each((index,el)=>{
        var txt=$(el).find("input").val();
        if(txt.length) {
            list.push({
                "text": txt,
                "after": ""
            });
        }
    });
    var state={
        "mode": $("body").attr("class"),
        "playlist": list
    };
    fs.writeJsonSync(`${__dirname}/../data/state.json`,state);
}

function mountPlaylistItem(li,index=0,start=false) {
    var $li=$(li);
    var key=$li.find("input").val();
    var livideos=$li.prop("videos");
    var item=livideos[index];
    if( item ) {
        pauseVideo();
        console.log(`Mounting #${index} "${item.displayName}" (with ${item.list.length} cues).`);
        $("#text").hide();
        video.setAttribute("data-video-index",index);
        video.setAttribute("data-cue-index",item.list.length>=0?0:-1);
        if( item.list.length ) {
            video.src=item.path;
            video.currentTime=parseFloat(item.list[0].start);
            if(start) playVideo();
        }
    } else {
        console.log(`Nothing found for "${key}". Blanking video.`);
        video.src="";
        video.currentTime=0;
        video.setAttribute("data-video-index",-1);
        video.setAttribute("data-cue-index",-1);
        $("#text").text(key).css("line-height",$(video).css("height")).show();
    }
}

function updateVideoUI(){
    $curTime.text(video.currentTime.toFixed(2));
}

function checkVideo(){
    var curVideoIndex=Number(video.getAttribute("data-video-index"));
    var curCueIndex=Number(video.getAttribute("data-cue-index"));
    if( curCueIndex>=0 && curVideoIndex>=0 ) {
        var $li=$("#playlist li.selected");
        var videos=$li.prop("videos");
        var v=videos[curVideoIndex];
        var endTime=parseFloat((v.list.length>curCueIndex)?v.list[curCueIndex].end:0);
        $("#playlist .selected .progress, .fullscreenMode.progress")
            .css("width",`${calcPlayPercentage(videos,curVideoIndex,curCueIndex,video.currentTime)}%`);
        // Take action if video has passed the designated end time.
        // Check only to 2 decimals because some software calculates video duration accurate to 2 decimals only.
        if( video.currentTime.toFixed(2)>=endTime ) {
            if( curCueIndex<v.list.length-1 ) {
                curCueIndex+=1;
                console.log("Moving to cue #"+curCueIndex+".");
                video.currentTime=parseFloat(v.list[curCueIndex].start);
                video.setAttribute("data-cue-index",curCueIndex);
            } else if( curVideoIndex<videos.length-1 ) {
                mountPlaylistItem($li,curVideoIndex+1,true);
            } else {
                pauseVideo();
                video.setAttribute("data-video-index","-1");
                video.setAttribute("data-cue-index","-1");
            }
        }
    }
}

function calcPlayPercentage(videos,videoIndex,cueIndex,pos) {
    var sum=0, cueMax;
    // Calculate sum of all past videos/cues played so far
    for( var vi=0 ; vi<=videoIndex ; vi++ ) {
        cueMax=(vi==videoIndex)?cueIndex:videos[vi].list.length;
        for( ci=0 ; ci<cueMax ; ci++ )
            if( videos[vi].list.length>ci )
                sum+=videos[vi].list[ci].end-videos[vi].list[ci].start;
    }
    // Now add time for the current video
    if( videos[videoIndex].list.length>cueIndex )
        sum+=pos-videos[videoIndex].list[cueIndex].start;
    // Figure out total play time
    var fullPlayLength=0;
    for( vi=0 ; vi<videos.length ; vi++ ) fullPlayLength+=videos[vi].calcPlayLength();
    // And calculate percentage
    var pct=parseInt(100*sum/fullPlayLength);
    // Protect from math gone wild
    if(pct>100) pct=100; 
    else if( pct<0 ) pct=0;
    return pct;
}


function toggleFullscreen(){
    if( $('body').hasClass('fullscreenMode') ) {
        $('body').removeClass('fullscreenMode').addClass('playlistMode');
    } else {
        $('body').removeClass('playlistMode').addClass('fullscreenMode');
    }
    $("#text").css("line-height",$(video).css("height"));
}

function toggleVideo(){
    if(video.paused && video.readyState>2) playVideo();
    else pauseVideo();
}
function playVideo(){
    $("#videoControls .vidplaypause").removeClass("fa-play").addClass("fa-pause");
    video.play();
}
function pauseVideo(){
    $("#videoControls .vidplaypause").removeClass("fa-pause").addClass("fa-play");
    video.pause();
}
function prevVideo(){
    var $li=$("#playlist .selected");
    if( $li.length==0 ) {
        selectPlaylistItem($("#playlist li:first"));
    } else if( ! $li.is(":first-child") ) {
        selectPlaylistItem($li.prev());
    } else {
        mountPlaylistItem($li);
    }
}
function nextVideo(){
    var $li=$("#playlist .selected");
    if( $li.length==0 ) {
        selectPlaylistItem($("#playlist li:last"));
    } else if( ! $li.is(":last-child") ) {
        selectPlaylistItem($li.next());
    }
}

function addPlaylistRow(item) {
    var newli=$(`
        <li class="new">
            <span class="progress"></span>
            <span class="handle">&#9776;</span>
            <input type="text" placeholder="Enter scripture or publication reference" />
            <span class="tag"></span>
            <i class="fa fa-refresh fa-spin fa-fw loader"></i>
        </li>
    `)
    .prop("videos",[])
    .find("input")
        .blur(playlistItemBlur)
        .focus(playlistItemFocus)
        .keyup(playlistItemKeyUp)
        .keydown(playlistItemKeyDown)
    .end();
    if( item ) $(newli).insertAfter(item);
    else $("#playlist ol").append(newli);
}
function playlistItemFocus(){
    var $li=$(this).parent();
    if( ! $li.hasClass("selected") ) selectPlaylistItem($(this).parent());
}
function selectPlaylistItem(li) {
    $(li)
        .parents("ol").find(".selected").removeClass("selected").end().end()
        .addClass("selected")
        .find(".progress").css("width",0).end()
        .find("input").select();
    mountPlaylistItem(li);
}
function playlistItemBlur(){
    parsePlaylistItem(this);
}
function playlistItemKeyDown(e){
    var key=e.key.toLowerCase();
    var fullSelection=(e.target.value==window.getSelection().toString());
    if( fullSelection && key==" " ) {
        toggleVideo();
        return false;
    } else if( fullSelection && key=="f" ) {
        toggleFullscreen();
        return false;
    }
}
function playlistItemKeyUp(e){
    var $input=$(e.target);
    var $li=$input.parent();
    var val=$input.val();
    if( e.key=="ArrowUp" ) {
        prevVideo();
        return false;
    } else if( e.key=="ArrowDown" || e.key=="Enter" ) {
        nextVideo();
        return false;
    } else if( val.length>0 && $li.is(":last-child") ) {
        addPlaylistRow($li);
    } else if( val.length==0 && ! $li.is(":last-child") && $li.next().find("input").val().length==0 ) {
        $li.next().remove();
    }
    if( ["ArrowLeft","ArrowRight","Shift","Meta","Alt","Control","Escape","Tab"].indexOf(e.key)<0 )
        $li.removeClass(PLAYLISTITEM_CLASSES).addClass("new");
}

function parsePlaylistItem(fld) {
    var txt=$(fld).val();
    var item=null;
    var className="valid";
    var tagText="";
    var tagHint="";
    var $li=$(fld).parent();
    if( txt.length && txt!=$li.prop("data-videos-text") ) {
        console.log(`Parsing field with "${txt}"...`)
        var scriptures=su.parseScriptures(txt);
        var parseCount=scriptures.length;
        var livideos=new Array(scriptures.length);
        if( scriptures.length ) {
            $li.addClass("parsing");
            for( var i=0 ; i<scriptures.length ; i++ ) {
                svu.createVideo(scriptures[i],(err,item)=>{
                    // If an error occurs for any scripture parse, mark the playlist row in error.
                    if(err) {
                        console.log(err);
                        tagText=err.tag;
                        tagHint=err.message;
                        className="mediaErr";
                    }
                    // If `item` is an array, its an array of single verse videos for the scripture. This requires more work.
                    // Otherwise, just put the new item in the livideos array.
                    if( Array.isArray(item) ) {
                        // Create a scripture object based on the array
                        let itemArrayScripture=new Scripture(item[0].scripture.book,item[0].scripture.chapter);
                        for( let sv of item ) itemArrayScripture.verses.push(sv.scripture.verses[0]);
                        // Find the composite scripture's position in the array of scriptures for this row. Put the array in that position.
                        let lipos=scriptures.findIndex((scr)=>{return scr.toString()==itemArrayScripture.toString()});
                        if( lipos>=0 ) livideos[lipos]=item;
                    } else {
                        livideos[scriptures.indexOf(item.scripture)]=item;
                    }
                    // Once all videos have been parsed/created, finally do UI handling.
                    if( --parseCount<=0 ) {
                        // Find any "composite scripture" arrays and flatten them out with the rest of the array 
                        for( let lipos=0 ; lipos<livideos.length ; lipos++ ) {
                            if( Array.isArray(livideos[lipos]) )
                                livideos.splice(lipos,1,...livideos[lipos]);
                        }
                        // Get all scriptures from the array, rebuilding composite scripture videos into one single scripture object.
                        let liscriptures=[];
                        for( let livideo of livideos ) {
                            let prevScripture=liscriptures.length>0?liscriptures[liscriptures.length-1]:undefined;
                            if( prevScripture && 
                                    prevScripture.book.num==livideo.scripture.book.num && 
                                    prevScripture.chapter==livideo.scripture.chapter ) {
                                prevScripture.verses.push(...livideo.scripture.verses)
                            } else {
                                liscriptures.push(livideo.scripture);
                            }
                        }
                        // Finally, create an array of friendly scripture names
                        let dispNames=[];
                        liscriptures.forEach((liscripture)=>{dispNames.push(liscripture.toString())});
                        // Set all data to the playlist item.
                        $li .removeClass(PLAYLISTITEM_CLASSES).addClass(className)
                            .prop("videos",livideos)
                            .prop("data-videos-text",dispNames.join(";"))
                            .find(".tag").text(tagText).attr("title",tagHint).end()
                            .find("input").val(dispNames.join("; ")).end();
                    }
                });
            }
        }
        else if( $.trim(txt).length ) {
            className="parseErr";
            $li .removeClass(PLAYLISTITEM_CLASSES).addClass(className)
                .prop("videos",[])
                .prop("data-videos-text",txt)
                .find(".tag").text(tagText);
        }
    }
}

function windowKeyDownHandler(e) {
    var key=e.key.toLowerCase();
    if( $(e.target).is("input") ) {
        return true;
    } else if( key==" " ) {
        toggleVideo();
    } else if( key=="q" || key=="x" ) {
        quit();
    } else if( key=="f" || (key=="escape" && $("body").hasClass("fullscreenMode")) ) {
        e.preventDefault();
        toggleFullscreen();
    }
}

function windowKeyUpHandler(e) {
    var key=e.key.toLowerCase();
    if( $(e.target).is("input") ) {
        return true;
    } else if( key=="arrowup" || key=="arrowleft" ) {
        e.preventDefault();
        prevVideo();
    } else if( key=="arrowdown" || key=="arrowright" ) {
        e.preventDefault();
        nextVideo();
    }
}

function quit(){
    saveState();
    main.quit();
}