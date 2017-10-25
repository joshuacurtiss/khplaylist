const fs=require("fs-extra");
const path=require("path");
const hash=require("string-hash");

class WebvttCacheManager {

    constructor(opts) {
        // Set initial values
        var options=Object.assign(WebvttCacheManager.DEFAULTOPTIONS,opts);
        this.cacheMode=options.cacheMode;
        this.internalCacheDir=options.internalCacheDir;
        if( this.cacheMode==WebvttCacheManager.CACHEMODES.EXTERNAL ) this.webvttpaths=options.webvttpaths;
        else if( this.cacheMode==WebvttCacheManager.CACHEMODES.INTERNAL ) this.webvttpaths=this.internalCacheDir;
        else this.webvttpaths=[];
        return this;
    }

    get webvttpaths(){return this._webvttpaths}
    set webvttpaths(webvttpaths=[]) {
        this._webvttpaths=Array.isArray(webvttpaths)?webvttpaths:[webvttpaths];
        // Keep a list of all the videos
        var webvtts=[], f, ext;
        for( var webvttpath of this._webvttpaths ) {
            var pathwalk=[];
            try {
                pathwalk=fs.walkSync(webvttpath);
            } catch(err) {}
            for( var p of pathwalk ) {
                f=path.basename(p);
                ext=path.extname(f).toLowerCase();
                if( WebvttCacheManager.EXTENSIONS.indexOf(ext)>=0 ) webvtts.push(p);
            }
        }
        console.log(`Found ${webvtts.length} webvtt files.`);
        this.webvtts=webvtts;
    }

    calcWebvttPath(videofile="") {
        if( this.cacheMode==WebvttCacheManager.CACHEMODES.INTERNAL ) 
            return this.internalCacheDir+path.sep+path.basename(videofile)+"."+hash(videofile)+WebvttCacheManager.EXTENSIONS[0];
        else if( this.cacheMode==WebvttCacheManager.CACHEMODES.EXTERNAL )
            return videofile+WebvttCacheManager.EXTENSIONS[0];
        else
            return undefined;
    }

    findWebvttFile(videofile="") {
        var webvttPath=this.calcWebvttPath(videofile);
        // TODO: Note this approach is TOO exacting.  Want to be able to reference 
        // an internal library of webvtts as well, for correcting erroneous files with 
        // bad chapter references. I dunno, maybe that should be done as an exception
        // anyway. We'll see later when I can think clearer. 
        return this.webvtts.find(value=>webvttPath===value);
    }

    saveWebvttFile(videofile, webvtt) {
        var webvttpath=this.calcWebvttPath(videofile);
        if( webvttpath ) {
            fs.writeFileSync(webvttpath, webvtt);
            this.webvtts.push(webvttpath);
        }
        return webvttpath;
    }

}

WebvttCacheManager.EXTENSIONS=[
    ".webvtt",
    ".vtt"
];
WebvttCacheManager.CACHEMODES={
    NONE: "none", 
    INTERNAL: "internal", 
    EXTERNAL: "external"
};
WebvttCacheManager.DEFAULTOPTIONS={
    webvttpaths: [],
    cacheMode: WebvttCacheManager.CACHEMODES.INTERNAL,
    internalCacheDir: path.normalize(__dirname+path.sep+"webvttcache")
};

module.exports=WebvttCacheManager;