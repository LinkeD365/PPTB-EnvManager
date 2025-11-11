import * as React from "react";
import {
  Button,
  TeachingPopoverCarousel,
  TeachingPopoverCarouselCard,
  TeachingPopoverCarouselFooter,
  TeachingPopoverCarouselPageCount,
} from "@fluentui/react-components";

import {
  TeachingPopover,
  TeachingPopoverBody,
  TeachingPopoverHeader,
  TeachingPopoverSurface,
  TeachingPopoverTrigger,
} from "@fluentui/react-components";
import { Info16Regular } from "@fluentui/react-icons";
import { orgProp } from "../model/OrgSetting";

interface InfoPopupProps {
  item: orgProp;
}

export const InfoPopup = ({ item }: InfoPopupProps): React.JSX.Element => (
  <TeachingPopover>
    <TeachingPopoverTrigger>
      <Button appearance="transparent" icon={<Info16Regular />} />
    </TeachingPopoverTrigger>
    <TeachingPopoverSurface>
      <TeachingPopoverHeader>{item.name}</TeachingPopoverHeader>
      <TeachingPopoverCarousel defaultValue="1">
        <TeachingPopoverCarouselCard value="1">
          <TeachingPopoverBody>
            <div
              style={{ marginTop: 8, maxWidth: "300px", marginBottom: 16 }}
              dangerouslySetInnerHTML={{
                __html: item.description || "",
              }}
            />
            {/* {item.url ? (<>
            <a href={item.url} target="_blank" rel="noopener noreferrer">test</a>
          <Link href={item.url} target="_blank" rel="noopener noreferrer">
            {item.urlTitle || item.url}
          </Link></>
        ) : null}
        {item.linkeD365Url ? (
          <Link href={item.linkeD365Url} target="_blank" rel="noopener noreferrer">
            {item.linkeD365UrlTitle || item.linkeD365Url}
          </Link>
        ) : null} */}
          </TeachingPopoverBody>
        </TeachingPopoverCarouselCard>
        {item.linkeD365Description && (
          <TeachingPopoverCarouselCard value="2">
            <TeachingPopoverBody>
              {" "}
              <div
                style={{ marginTop: 8, maxWidth: "300px", marginBottom: 16 }}
                dangerouslySetInnerHTML={{
                  __html: item.linkeD365Description || "",
                }}
              />
            </TeachingPopoverBody>
          </TeachingPopoverCarouselCard>
        )}
        {item.linkeD365Description && (
         <TeachingPopoverCarouselFooter
          next="LinkedD365 Info"
          previous="Previous"
          initialStepText="Close"
          finalStepText="Finish"
        >
          <TeachingPopoverCarouselPageCount>
            {(currentIndex: number, totalPages: number) =>
              `${currentIndex} of ${totalPages}`
            }
          </TeachingPopoverCarouselPageCount>
        </TeachingPopoverCarouselFooter>)}
      </TeachingPopoverCarousel>
    </TeachingPopoverSurface>
  </TeachingPopover>
);
