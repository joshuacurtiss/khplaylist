// Link to main process
const electron=require("electron");
const main=electron.remote.require("./main.js");

// Dependencies
const os=require("os");
const path=require("path");
const fs=require("fs-extra");
const WebVttWrapperController=require("../bower_components/webvtt/wrappers/WrapperController");
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
var videos={};

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
    else $firstli.find("input").focus();
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

function mountPlaylistItem(li,start) {
    var key=$(li).find("input").val();
    var item=videos[key];
    if( start==undefined ) start=false;
    if( item ) {
        pauseVideo();
        console.log(`Mounting "${key}" (with ${item.list.length} cues).`);
        video.setAttribute("data-video-key",key);
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
    }
}

function updateVideoUI(){
    $curTime.text(video.currentTime.toFixed(2));
}

function checkVideo(){
    var key=video.getAttribute("data-video-key");
    var curCueIndex=Number(video.getAttribute("data-cue-index"));
    if( curCueIndex>=0 ) {
        var v=videos[key];
        $("#playlist .selected .progress").css("width",`${v.calcPlayPercentage(curCueIndex,video.currentTime)}%`);
        if( video.currentTime>=parseFloat(v.list[curCueIndex].end) ) {
            if( curCueIndex<v.list.length-1 ) {
                curCueIndex+=1;
                video.currentTime=parseFloat(v.list[curCueIndex].start);
                video.setAttribute("data-cue-index",curCueIndex);
            } else {
                pauseVideo();
                video.setAttribute("data-cue-index","-1");
            }
        }
    }
}

function toggleFullscreen(){
    if( $('body').hasClass('fullscreenMode') ) {
        $('body').removeClass('fullscreenMode').addClass('playlistMode');
    } else {
        $('body').removeClass('playlistMode').addClass('fullscreenMode');
    }
}

function toggleVideo(){
    if(video.paused) playVideo();
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
    if( txt.length ) {
        console.log(`Parsing field with "${txt}"...`)
        var scriptures=su.parseScriptures(txt);
        if( scriptures.length ) {
            $li.addClass("parsing");
            svu.createVideo(scriptures[0],(err,item)=>{
                if(err) {
                    console.log(err);
                    tagText=err.tag;
                    tagHint=err.message;
                    className="mediaErr";
                } else {
                    // TODO: Note that this will accumulate objects unless there is some kind of 
                    // garbage collection or way to delete discarded entries.
                    videos[item.displayName]=item;
                    $(fld).val(item.displayName);
                }
                $li .removeClass(PLAYLISTITEM_CLASSES).addClass(className)
                    .find(".tag").text(tagText).attr("title",tagHint).end()
                    .find("input").val(item.displayName).end();
            });
        }
        else if( $.trim(txt).length ) {
            className="parseErr";
            $li .removeClass(PLAYLISTITEM_CLASSES).addClass(className)
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