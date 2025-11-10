import { makeObservable, observable } from 'mobx';
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

    constructor(){
        this.current = '';
        this.name = '';

        makeObservable(this, {
            name: observable,
            current: observable,
            new: observable,
            type: observable,
            min: observable,
            max: observable,
            minVersion: observable,
            maxVersion: observable,
            default: observable,
            options: observable
        });
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