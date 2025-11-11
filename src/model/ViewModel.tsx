import { orgProp } from "../model/OrgSetting";
import { makeObservable, observable } from 'mobx';

export class ViewModel{
    
    blankList: orgProp[];
    fullList: orgProp[];
    orgId: string;
    constructor(){
    
        this.fullList = observable([]);
        this.blankList = [];
        this.orgId = "";
        makeObservable(this, {
    
            fullList: observable,
            orgId: observable
        });
    }
}

