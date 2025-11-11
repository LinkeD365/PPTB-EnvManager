import { Checkbox, Input } from "@fluentui/react-components";
import React from "react";
import { orgProp } from "../model/OrgSetting";
import { runInAction } from "mobx";
import { observer } from "mobx-react";

interface InputControlProps {
  item: orgProp;
  setItemNewValue: (item: orgProp, newValue: string) => void;
}

// Separate component for the toggle details to maintain state correctly
export const InputControl = observer((props: InputControlProps): React.JSX.Element => {
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
              checked={item.new === "true"}
              onClick={(e) => {
                e.stopPropagation();
                runInAction(() => {
                  item.new = item.new === "true" ? "false" : "true";
                  props.setItemNewValue(item, item.new );
                });
              }}
            />
          </div>
        );
      case "Number":
        return (
          <Input
            type="number"
            min={item.min ? Number(item.min) : undefined}
            max={item.max ? Number(item.max) : undefined}
            value={item.new}
            aria-label={`${item.name} number`}
            onChange={(e) => {
              e.stopPropagation();
              if (item.max && Number(e.target.value) > Number(item.max)) {
                e.target.value = item.max;
              }
              if (item.min && Number(e.target.value) < Number(item.min)) {
                e.target.value = item.min;
              }
              props.setItemNewValue(item, e.target.value);
            }}
          />
        );
      case "String":
        return (
          <Input 
            type="text"
            value={item.new}
            aria-label={`${item.name} text`}
            onChange={(e) => {
              e.stopPropagation();
              props.setItemNewValue(item, e.target.value);
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
          border: "1px solid #ccc",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 8,
          width: "100%",
        }}
      >
        {item.edit && input}
      </div>
    </div>
  );
});
