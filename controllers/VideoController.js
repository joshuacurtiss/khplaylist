class VideoController {
    
    constructor(videoElem,textElem) {
        this.videoElem=videoElem;
        this.textElem=textElem;
        this.secondWin=undefined;
        this.props={};
        return this;
    }

    get secondWin() {
        return this._secondWin;
    }

    set secondWin(win) {
        this._secondWin=win;
        // If a second window is set, mute this video. If no second window, don't mute this video.
        this.video.muted=(win!==undefined);
    }

    get video() {
        return this.videoElem;
    }

    set text(text) {
        this.textElem.style.visibility="hidden";
        this.textElem.style.zIndex="-99";
        this.textElem.innerHTML=text;
        // Wait for next tick to give video element time to resize. This ensures more accurate text placement.
        setTimeout(()=>{
            if( text.length ) this.textElem.style.top=(this.video.offsetHeight*.46-this.textElem.offsetHeight/2)+"px";
            this.textElem.style.visibility=text.length?"visible":"hidden";
            this.textElem.style.zIndex=text.length?"999":"-99";
        },0);
        if( this.secondWin ) 
            this.secondWin.webContents.executeJavaScript(`videoController.text=\`${text}\``);
    }

    get text() {
        return this.textElem.innerHTML;
    }

    set src(src) {
        this.video.src=src;
        if( this.secondWin )
            this.secondWin.webContents.executeJavaScript(`videoController.src=\`${src}\``);
    }

    get src() {
        return this.video.src;
    }

    get backgroundImage() {
        return this.video.style.backgroundImage;
    }

    set backgroundImage(src) {
        this.video.style.backgroundImage=src;
        if( this.secondWin ) 
            this.secondWin.webContents.executeJavaScript(`videoController.backgroundImage=\`${src}\``);
}
    
    set currentTime(time) {
        this.video.currentTime=time;
        if( this.secondWin ) 
            this.secondWin.webContents.executeJavaScript(`videoController.currentTime=${time}`);
    }
    
    get currentTime() {
        return this.video.currentTime;
    }

    get duration() {
        return this.video.duration;
    }

    get paused() {
        return this.video.paused;
    }

    isImage() {
        return ! this.isVideo();
    }

    isVideo() {
        return this.backgroundImage==="none";
    }

    pause() {
        this.video.pause();
        if( this.secondWin ) 
            this.secondWin.webContents.executeJavaScript(`videoController.pause()`);
    }

    play() {
        this.video.play();
        if( this.secondWin ) 
            this.secondWin.webContents.executeJavaScript(`videoController.play()`);
}

    set(prop,val) {
        this.props[prop.toLowerCase()]=val;
    }

    get(prop) {
        return this.props[prop.toLowerCase()];
    }

    pushUpdate() {
        var {src, currentTime, text, backgroundImage}=this;
        if( this.secondWin )
            this.secondWin.webContents.executeJavaScript(`
                videoController.text=\`${text}\`;
                videoController.backgroundImage=\`${backgroundImage}\`;
                videoController.src=\`${src}\`;
                videoController.currentTime=${currentTime};
            `);
    }

}

module.exports=VideoController;