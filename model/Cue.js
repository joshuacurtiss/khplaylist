class Cue {

    constructor(start,end,content) {
        this.start=start;
        this.end=end;
        this.min=start;
        this.max=end;
        this.content=content;
        return this;
    }

}

module.exports=Cue;