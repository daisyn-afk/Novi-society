import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import SaveRepContactForm from "@/components/provider/SaveRepContactForm";

export default function RepInfoModal({
  open,
  onClose,
  manufacturer,
  applicationId = null,
  initialRep = null,
}) {
  const mfrName = manufacturer?.name || "Supplier";

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}>
            {mfrName} — Rep Info
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm leading-relaxed -mt-1" style={{ color: "rgba(30,37,53,0.6)" }}>
          Save your assigned account rep&apos;s contact details. This will be used when sending orders and messages.
        </p>

        <SaveRepContactForm
          key={`${manufacturer?.id}-${initialRep?.updated_at || initialRep?.id || "new"}-${open}`}
          variant="modal"
          manufacturer={manufacturer}
          applicationId={applicationId}
          initialRep={initialRep}
          showSkip={false}
          onSaved={() => onClose()}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}
