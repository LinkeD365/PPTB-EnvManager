import { orgProp } from "../model/OrgSetting";
import { makeAutoObservable, observable } from "mobx";

export class ViewModel {
  blankList: orgProp[];
  fullList: orgProp[];
  theme: string;
  primaryOrgId: string;
  secondaryOrgId?: string;
  constructor() {
    this.fullList = observable([]);
    this.blankList = [];
    this.theme = "light";
    this.primaryOrgId = "";

    makeAutoObservable(this);
  }
}
