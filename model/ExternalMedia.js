const Publication=require("./Publication.js");
const WebVTT=require("./WebVTT");

class ExternalMedia {

    constructor(path) {
        this.path=path;
        return this;
    }

    get displayName() {return this.fileName}

    get fileName() {
        var pArray=this.path.split("/");
        return pArray[pArray.length-1];
    }
    get extension() {
        var extArray=this.fileName.split(".");
        return extArray[extArray.length-1].toLowerCase();
    }

    isImage() {return (ExternalMedia.IMAGE_EXTENSIONS.indexOf(this.extension)>=0)}
    isVideo() {return (ExternalMedia.VIDEO_EXTENSIONS.indexOf(this.extension)>=0)}

}

ExternalMedia.IMAGE_EXTENSIONS=["png","jpg","gif","jpeg","bmp"];
ExternalMedia.VIDEO_EXTENSIONS=["mov","mp4","m4v","avi","webm"];

module.exports=ExternalMedia;