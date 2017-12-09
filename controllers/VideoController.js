class VideoController {
    
    constructor(video) {
        this.video=video;
        this.props={};
        return this;
    }

    set src(src) {
        this.video.src=src;
    }

    get src() {
        return this.video.src;
    }

    set backgroundImage(src) {
        this.video.style.backgroundImage=src;
    }
    
    set currentTime(time) {
        this.video.currentTime=time;
    }
    
    get currentTime() {
        return this.video.currentTime;
    }

    get duration() {
        return this.video.duration;
    }

    pause() {
        this.video.pause();
    }

    play() {
        this.video.play();
    }

    set(prop,val) {
        this.props[prop.toLowerCase()]=val;
    }

    get(prop) {
        return this.props[prop.toLowerCase()];
    }

}

module.exports=VideoController;