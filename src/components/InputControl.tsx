import { Checkbox, Input } from "@fluentui/react-components";
import React from "react";
import { orgProp, getSlotNew, setSlotNew } from "../model/OrgSetting";
import { runInAction } from "mobx";
import { observer } from "mobx-react";

interface InputControlProps {
  item: orgProp;
  setItemNewValue: (item: orgProp, newValue: string, slot?: number) => void;
  slot?: number;
}

// Separate component for the toggle details to maintain state correctly
export const InputControl = observer((props: InputControlProps): React.JSX.Element => {
  const { slot = 0 } = props;
  //  const { item, setItemNewValue } = props;
  const [item] = React.useState(props.item);
  //const [open, setOpen] = React.useState(false);
  const input = (() => {
    switch (item.type) {
      case "Boolean":
        return (
          <div>
            <Checkbox
              aria-label={`${item.name} boolean`}
              checked={getSlotNew(item, slot) === "true"}
              onClick={(e) => {
                e.stopPropagation();
                runInAction(() => {
                  const next = getSlotNew(item, slot) === "true" ? "false" : "true";
                  setSlotNew(item, slot, next);
                  props.setItemNewValue(item, next, slot);
                });
              }}
            />
          </div>
        );
      case "Number":
        return (
          <Input
            style={{ marginTop: "4px" }}
            type="number"
            min={item.min ? Number(item.min) : undefined}
            max={item.max ? Number(item.max) : undefined}
            value={getSlotNew(item, slot) ?? ""}
            aria-label={`${item.name} number`}
            onChange={(e) => {
              e.stopPropagation();
              if (item.max && Number(e.target.value) > Number(item.max)) {
                e.target.value = item.max;
              }
              if (item.min && Number(e.target.value) < Number(item.min)) {
                e.target.value = item.min;
              }
              props.setItemNewValue(item, e.target.value, slot);
            }}
          />
        );
      case "String":
        return (
          <Input
            type="text"
            value={getSlotNew(item, slot) ?? ""}
            aria-label={`${item.name} text`}
            onChange={(e) => {
              e.stopPropagation();
              props.setItemNewValue(item, e.target.value, slot);
            }}
          />
        );
      default:
        return null;
    }
  })();

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
        }}
      >
        {item.edit && input}
      </div>
    </div>
  );
});
