import { Checkbox, Input } from "@fluentui/react-components";
import React from "react";
import { orgProp } from "../model/OrgSetting";
import { runInAction } from "mobx";
import { observer } from "mobx-react";

interface InputControlProps {
  item: orgProp;
  setItemNewValue: (item: orgProp, newValue: string, secondary?: boolean) => void;
  secondary?: boolean;
}

// Separate component for the toggle details to maintain state correctly
export const InputControl = observer((props: InputControlProps): React.JSX.Element => {
  const { secondary = false } = props;
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
              checked={secondary ? item.secondaryNew === "true" : item.new === "true"}
              onClick={(e) => {
                e.stopPropagation();
                runInAction(() => {
                  if (secondary) {
                    item.secondaryNew = item.secondaryNew === "true" ? "false" : "true";
                    props.setItemNewValue(item, item.secondaryNew ?? "", true);
                  } else {
                    item.new = item.new === "true" ? "false" : "true";
                    props.setItemNewValue(item, item.new ?? "", false);
                  }
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
            value={secondary ? item.secondaryNew ?? "" : item.new ?? ""}
            aria-label={`${item.name} number`}
            onChange={(e) => {
              e.stopPropagation();
              if (item.max && Number(e.target.value) > Number(item.max)) {
                e.target.value = item.max;
              }
              if (item.min && Number(e.target.value) < Number(item.min)) {
                e.target.value = item.min;
              }
              props.setItemNewValue(item, e.target.value, secondary);
            }}
          />
        );
      case "String":
        return (
          <Input
            type="text"
            value={item.new ?? ""}
            aria-label={`${item.name} text`}
            onChange={(e) => {
              e.stopPropagation();
              props.setItemNewValue(item, e.target.value, secondary);
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
