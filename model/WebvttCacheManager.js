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
        if( this.cacheMode==WebvttCacheManager.CACHEMODES.EXTERNAL.id ) {
            this.webvttpaths=[this.patchDir].concat(options.webvttpaths);
        } else if( this.cacheMode==WebvttCacheManager.CACHEMODES.INTERNAL.id ) {
            this.webvttpaths=[this.patchDir,this.internalCacheDir];
        } else {
            this.webvttpaths=[this.patchDir];
        }
        return this;
    }

    get webvttpaths(){return this._webvttpaths}
    set webvttpaths(webvttpaths=[]) {
        this._webvttpaths=Array.isArray(webvttpaths)?webvttpaths:[webvttpaths];
        // Now that you've set the paths, index all of the webvtts
        this.indexWebvttFiles();
    }

    indexWebvttFiles() {
        var webvtts=[], f, ext;
        for( var webvttpath of this.webvttpaths ) {
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

    purgeWebvttFiles() {
        for( var webvttfile of this.webvtts ) {
            // Don't delete the webvtts in the patch directory.
            if( webvttfile.indexOf(this.patchDir)<0 ) {
                console.log(`Removing ${webvttfile}.`);
                // Delete synchronously to make sure we delete everything before reindexing.
                fs.removeSync(webvttfile);
            }
        }
        // Reindex the webvtts after deleting stuff.
        this.indexWebvttFiles();
    }

    purgeOldWebvttFiles(videofiles=[]) {
        for( var videofile of videofiles ) {
            var webvttfile=this.findWebvttFile(videofile);
            if( webvttfile ) {
                var webvttStat=fs.statSync(webvttfile);
                var videoStat=fs.statSync(videofile);
                if( webvttStat.birthtime<videoStat.birthtime ) {
                    console.log(`Removing ${webvttfile} because it is older than its video file.`);
                    // Find in index and remove from index
                    var idx=this.webvtts.indexOf(webvttfile);
                    if( idx>=0 ) this.webvtts.splice(idx,1);
                    // Physically remove the file, asynchronously since we don't care about it
                    fs.remove(webvttfile);
                }
            }
        }
    }

    calcWebvttPath(videofile="") {
        var webvttFilename=path.basename(videofile)+"."+hash(videofile)+WebvttCacheManager.EXTENSIONS[0];
        if( this.cacheMode==WebvttCacheManager.CACHEMODES.INTERNAL.id ) 
            return this.internalCacheDir+path.sep+webvttFilename;
        else if( this.cacheMode==WebvttCacheManager.CACHEMODES.EXTERNAL.id )
            return path.dirname(videofile)+path.sep+webvttFilename;
        else
            return undefined;
    }

    calcWebvttRegEx(videofile="") {
        // Just return undefined if they did not pass a path, or if cache mode is "none".
        if( videofile=="" ) return undefined;
        if( this.cacheMode==WebvttCacheManager.CACHEMODES.NONE.id ) return undefined;
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
        return webvttPathRegEx?this.webvtts.find(value=>webvttPathRegEx.test(value)):undefined;
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
    NONE: {id:"none",name:"None",desc:"No caching; reindex every time."}, 
    INTERNAL: {id:"internal",name:"Internal",desc:"Cache index in application internal storage. Recommended."}, 
    EXTERNAL: {id:"external",name:"External",desc:"Save index cache in .webvtt file in same directory as the video file. Not recommended."}
};
WebvttCacheManager.DEFAULTOPTIONS={
    webvttpaths: [],
    cacheMode: WebvttCacheManager.CACHEMODES.INTERNAL.id,
    internalCacheDir: path.normalize(__dirname+path.sep+"webvttcache"),
    patchDir: path.normalize(__dirname+path.sep+"webvttpatches")
};

module.exports=WebvttCacheManager;