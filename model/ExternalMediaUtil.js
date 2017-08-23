const ExternalMedia=require("./ExternalMedia");
let WrapperController=require("../bower_components/webvtt/wrappers/WrapperController");
let fs=require("fs-extra");

class ExternalMediaUtil {

    constructor(videoAppController) {
        this.videoAppController=videoAppController || new WrapperController();
        this.videoApp=this.videoAppController.wrapper;
        return this;
    }

    /*  
     *  parseExternalMedia:  Receives text and parses it into an array of ExternalMedia objects.
     *  It outputs an array even if only one object is matched. 
     * 
     */

    parseExternalMedia(text) {
        var objs=this.parseExternalMediaWithIndex(text);
        return objs.map(item=>item.obj);
    }

    parseExternalMediaWithIndex(text) {
        var objs=[], match, re=this.getPathRegEx();
        while(match=re.exec(text)) {
            let p=match[0];
            let webvtt=[];
            let media=new ExternalMedia(p,webvtt);
            if( fs.existsSync(p) ) {
                console.log(`Getting data. Valid: ${media.valid()}. Is video: ${media.isVideo()}`)
                if( media.valid() && media.isVideo() ) {
                    let info=this.videoApp.getInfoSync(p);
                    media.webvtt=[{
                        id: 0,
                        start: info.start,
                        end: info.duration,
                        name: media.filename
                    }];
                }
            }
            objs.push({obj:media,index:match.index});
        }
        return objs;
    }

    /*
     *  createVideo: Receives an ExternalMedia object, checks on it, and sends it
     *  back if all is well.  If not, though, It will report errors. For instance,
     *  if file doesn't exist or if the video info failed to be retrieved.  This is
     *  a little weird behavior for this object, but it's made to stay consistency 
     *  with the ReferenceVideoUtil and ScriptureVideoUtil objects. 
     * 
     */
    createVideo(media,cb) {
        if( ! media.valid() ) {
            // Isn't actually a real file. Report the error.
            console.log(`No file for ${media.toString()}.`);
            cb({code:"novideo",tag:"Not Found",message:"File could not be found!"},media);
        } else if( media.isVideo() && media.list.length==0 ) {
            // No list means we couldn't get details on the video.
            cb({code:"indexerr",tag:"Index Error",message:"No application available to index video!"},media);
        } else {
            // All is well. Just pass the media file right back.
            cb(null,media);
        }
    }

    /*
     *  getPathRegEx: Takes the simpler PATH_REGEX constant and subs out the EXTENSIONS
     *  placeholder with all of the actual extensions we use for external media.
     * 
     */
    getPathRegEx() {
        var exts=ExternalMedia.IMAGE_EXTENSIONS.concat(ExternalMedia.VIDEO_EXTENSIONS);
        return RegExp(ExternalMediaUtil.PATH_REGEX.source.replace("EXTENSIONS",exts.join("|")),ExternalMediaUtil.PATH_REGEX.flags);
    }

}

ExternalMediaUtil.PATH_REGEX=/((?:[a-z]:)?[\/\\].*?)([^\/\\]*?\.(?:EXTENSIONS))/igm;

module.exports=ExternalMediaUtil;