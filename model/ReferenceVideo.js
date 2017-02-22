const Publication=require("./Publication.js");
const WebVTT=require("./WebVTT");

class ReferenceVideo {

    constructor(reference,path,webvtt) {
        this.path=path;
        this.webvtt=webvtt;
        this.reference=reference; // Must be set after webvtt is set.
        return this;
    }

    get displayName() {return this.reference.toString()}

    get webvtt() {return this._webvtt}
    set webvtt(webvtt) {
        this._webvtt=new WebVTT(webvtt);
    }

    get reference() {return this._reference}
    set reference(reference) {
        this._reference=reference;
        if( reference.valid() ) {
            var list=[];
            var cues;
            // TODO: Fine-tune this logic to work with citations other than pars
            for( var p of reference.pars ) {
                cues=this.getCuesByPar(p);
                for( var cue of cues ) {
                    if( list.length && list[list.length-1].end==cue.start ) {
                        var last=list[list.length-1];
                        last.end=cue.end;
                        last.content=last.content.split("-")[0]+"-"+cue.content;
                    } else {
                        list.push({start:cue.start,end:cue.end,content:cue.content});
                    }
                }
            }
            this.list=list;
        }
    }

    getCuesByPar(par) {
        var parRegex=new RegExp(`^p ${par}[a-z]{0,1}$`,`i`);
        var parExtrasRegex=/^(p|q|r|subheading|box|art)\s/i;
        var match, index, first, last;
        // Find the first par match
        last=first=index=this.webvtt.data.findIndex((c)=>{return parRegex.test(c.content)});
        // Find the last par match (after the first one)
        while( index>=0 ) {
            index=this.webvtt.data.findIndex((c,idx)=>{return (idx>index && parRegex.test(c.content))});
            if( index>=0 ) last=index;
        }
        // Now check if any other materials after the par should be included
        index=last;
        while( index>=0 ) {
            if( index+1<this.webvtt.data.length && !parExtrasRegex.test(this.webvtt.data[index+1].content)) last=++index;
            else index=-1;
        }
        // Push out the matching cues
        var cues=[];
        for( index=first ; index<=last ; index++ ) cues.push(this.webvtt.data[index]);
        return cues;
    }
}

module.exports=ReferenceVideo;