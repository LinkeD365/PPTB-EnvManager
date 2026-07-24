import * as React from "react";
import {
  Button,
  Link,
  TeachingPopover,
  TeachingPopoverBody,
  TeachingPopoverHeader,
  TeachingPopoverSurface,
  TeachingPopoverTrigger,
} from "@fluentui/react-components";
import { Info16Regular } from "@fluentui/react-icons";
import { EnvApiGridRow } from "./EnvironmentSettingsGrid";

interface EnvironmentInfoPopupProps {
  item: EnvApiGridRow;
}

export const EnvironmentInfoPopup = ({ item }: EnvironmentInfoPopupProps): React.JSX.Element => (
  <TeachingPopover>
    <TeachingPopoverTrigger>
      <Button appearance="transparent" icon={<Info16Regular />} />
    </TeachingPopoverTrigger>
    <TeachingPopoverSurface>
      <TeachingPopoverHeader>{item.property}</TeachingPopoverHeader>
      <TeachingPopoverBody>
        <div style={{ marginTop: 8, maxWidth: "300px", marginBottom: 16 }}>
          {item.shortDescription || "No details available."}
        </div>
        {item.link && (
          <Link
            href={item.link}
            onClick={(event) => {
              event.preventDefault();
              void window.toolboxAPI.utils.openInConnectionBrowser(item.link!);
            }}
          >
            Learn more
          </Link>
        )}
      </TeachingPopoverBody>
    </TeachingPopoverSurface>
  </TeachingPopover>
);