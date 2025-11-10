import { orgProp } from "../model/OrgSetting";
import { makeObservable, observable } from 'mobx';

export class ViewModel{
    
    fullList: orgProp[];
    orgId: string;
    constructor(){
    
        this.fullList = observable([]);
        this.orgId = "";
        makeObservable(this, {
    
            fullList: observable,
            orgId: observable
        });
    }
}

