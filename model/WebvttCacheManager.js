const escapeStringRegexp=require("escape-string-regexp");
const fs=require("fs-extra");
const hash=require("string-hash");
const path=require("path");

class WebvttCacheManager {

    constructor(opts) {
        // Set initial values
        var options=Object.assign(WebvttCacheManager.DEFAULTOPTIONS,opts);
        this.cacheMode=options.cacheMode;
        this.internalCacheDir=options.internalCacheDir;
        this.patchDir=options.patchDir;
        if( this.cacheMode==WebvttCacheManager.CACHEMODES.EXTERNAL ) {
            this.webvttpaths=[this.patchDir].concat(options.webvttpaths);
        } else if( this.cacheMode==WebvttCacheManager.CACHEMODES.INTERNAL ) {
            this.webvttpaths=[this.patchDir,this.internalCacheDir];
        } else {
            this.webvttpaths=[this.patchDir];
        }
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
        var webvttFilename=path.basename(videofile)+"."+hash(videofile)+WebvttCacheManager.EXTENSIONS[0];
        if( this.cacheMode==WebvttCacheManager.CACHEMODES.INTERNAL ) 
            return this.internalCacheDir+path.sep+webvttFilename;
        else if( this.cacheMode==WebvttCacheManager.CACHEMODES.EXTERNAL )
            return path.dirname(videofile)+path.sep+webvttFilename;
        else
            return undefined;
    }

    calcWebvttRegEx(videofile="") {
        // Just return undefined if they did not pass a path, or if cache mode is "none".
        if( videofile=="" ) return undefined;
        if( this.cacheMode==WebvttCacheManager.CACHEMODES.NONE ) return undefined;
        // Accumulate possibilities:
        const extregex=`(?:${WebvttCacheManager.EXTENSIONS.map(x=>escapeStringRegexp(x)).join('|')})`;
        var possibilities=[
            escapeStringRegexp(path.sep+path.basename(videofile)+"."+hash(videofile))+extregex+"$",
            escapeStringRegexp(path.sep+path.basename(videofile))+extregex+"$"
        ];
        // Join them in a regex:
        return new RegExp(`(${possibilities.join('|')})`,'i');
    }

    findWebvttFile(videofile="") {
        var webvttPathRegEx=this.calcWebvttRegEx(videofile);
        return this.webvtts.find(value=>webvttPathRegEx.test(value));
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
    internalCacheDir: path.normalize(__dirname+path.sep+"webvttcache"),
    patchDir: path.normalize(__dirname+path.sep+"webvttpatches")
};

module.exports=WebvttCacheManager;