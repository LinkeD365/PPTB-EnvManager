import { makeAutoObservable } from 'mobx';
export class orgProp{
    name: string;
    current: string; //value from API
    new?: string; //valur to be presented to API
    description?: string;
    minVersion?: string;
    maxVersion?: string;
    type?: string;
    max?: string;
    min?: string;
    default?: string;
    edit?: boolean;
    options?: propOptions[];
    url?: string;
    urlTitle?: string;
    linkeD365Url?: string;
    linkeD365Description?: string;

    constructor(){
        this.current = '';
        this.name = '';

        makeAutoObservable(this);
    }
}

export class propOptions{
    label: string;
    value: string;
    intValue: number | null;
    constructor(label: string, value: string){
        this.label = label;
        this.value = value;
        this.intValue = null;
    }
}