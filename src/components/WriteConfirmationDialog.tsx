import type React from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import type { WriteConfirmation } from "../utils/writeConfirmation.mjs";

interface WriteConfirmationDialogProps {
  confirmation: WriteConfirmation | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function WriteConfirmationDialog({
  confirmation,
  onCancel,
  onConfirm,
}: WriteConfirmationDialogProps): React.JSX.Element {
  return (
    <Dialog
      open={confirmation !== null}
      modalType="alert"
      onOpenChange={(_event, data) => {
        if (!data.open) {
          onCancel();
        }
      }}
    >
      <DialogSurface style={{ maxHeight: "calc(100vh - 32px)" }}>
        {confirmation ? (
          <DialogBody>
            <DialogTitle>{confirmation.title}</DialogTitle>
            <DialogContent style={{ overflowY: "auto" }}>
              <p>{confirmation.summary}</p>
              <p>
                <strong>Target:</strong> {confirmation.target}
              </p>
              <Textarea
                aria-label="Changes (read-only)"
                readOnly
                rows={5}
                resize="none"
                value={confirmation.scope.join("\n")}
                root={{ style: { width: "100%" } }}
                textarea={{
                  style: {
                    backgroundColor: tokens.colorNeutralBackground3,
                    boxSizing: "border-box",
                    overflowY: "auto",
                    width: "100%",
                  },
                }}
              />
              <p>{confirmation.warning}</p>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={onCancel}>
                Cancel
              </Button>
              <Button appearance="primary" onClick={onConfirm}>
                Confirm and save
              </Button>
            </DialogActions>
          </DialogBody>
        ) : null}
      </DialogSurface>
    </Dialog>
  );
}
