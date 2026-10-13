import { makeAutoObservable } from "mobx";
export class orgProp {
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
  others?: Array<orgSlotValue | undefined>; //per-slot values for connections 1..n (index = slot)

  constructor() {
    this.current = "";
    this.name = "";
    this.others = [];

    makeAutoObservable(this);
  }
}

export type orgSlotValue = { current?: string; new?: string };

export function getSlotCurrent(item: orgProp, slot: number): string | undefined {
  return slot === 0 ? item.current : item.others?.[slot]?.current;
}

export function getSlotNew(item: orgProp, slot: number): string | undefined {
  return slot === 0 ? item.new : item.others?.[slot]?.new;
}

export function setSlotCurrent(item: orgProp, slot: number, value: string | undefined): void {
  if (slot === 0) {
    item.current = value ?? "";
    return;
  }
  item.others = item.others ?? [];
  item.others[slot] = { ...item.others[slot], current: value };
}

export function setSlotNew(item: orgProp, slot: number, value: string | undefined): void {
  if (slot === 0) {
    item.new = value;
    return;
  }
  item.others = item.others ?? [];
  item.others[slot] = { ...item.others[slot], new: value };
}

export class propOptions {
  label: string;
  value: string;
  intValue: number | null;
  constructor(label: string, value: string) {
    this.label = label;
    this.value = value;
    this.intValue = null;
  }
}
