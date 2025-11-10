import { Checkbox } from "@fluentui/react-components";
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
  const [item, setStateItem] = React.useState(props.item);
  //const [open, setOpen] = React.useState(false);
  const input = (() => {
    switch (item.type) {
      case "Boolean":
        return (
          <div>{item.new}
            <Checkbox   
              aria-label={`${item.name} boolean`}
              checked={item.new === "true"}
              onClick={(e) => {
                e.stopPropagation();
                console.log("Checkbox clicked", item.new);
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
          <input
            type="number"
            min={item.min ? Number(item.min) : undefined}
            aria-label={`${item.name} number`}
            onClick={(e) => {
              e.stopPropagation();
            }}
          />
        );
      case "String":
        return (
          <input
            type="text"
            aria-label={`${item.name} text`}
            onClick={(e) => {
              e.stopPropagation();
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
