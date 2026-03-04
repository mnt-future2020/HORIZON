import * as React from "react";
import { useIsMobile } from "@/hooks/useMediaQuery";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

function ResponsiveDialog({ children, ...props }) {
  const isMobile = useIsMobile();
  const Comp = isMobile ? Drawer : Dialog;
  return <Comp {...props}>{children}</Comp>;
}

function ResponsiveDialogTrigger({ children, ...props }) {
  const isMobile = useIsMobile();
  const Comp = isMobile ? DrawerTrigger : DialogTrigger;
  return <Comp {...props}>{children}</Comp>;
}

function ResponsiveDialogContent({ className, children, ...props }) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return (
      <DrawerContent className={cn("max-h-[85vh]", className)} {...props}>
        <div
          className="overflow-y-auto max-h-[calc(85vh-2rem)] px-4 pb-4"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 16px)" }}
        >
          {children}
        </div>
      </DrawerContent>
    );
  }
  return (
    <DialogContent
      className={cn(
        "bg-card border-border max-w-[95vw] sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-[28px]",
        className
      )}
      {...props}
    >
      {children}
    </DialogContent>
  );
}

function ResponsiveDialogHeader({ className, ...props }) {
  const isMobile = useIsMobile();
  const Comp = isMobile ? DrawerHeader : DialogHeader;
  return <Comp className={cn(isMobile && "text-left px-0 pt-0", className)} {...props} />;
}

function ResponsiveDialogTitle({ className, ...props }) {
  const isMobile = useIsMobile();
  const Comp = isMobile ? DrawerTitle : DialogTitle;
  return <Comp className={cn("font-display text-base sm:text-lg", className)} {...props} />;
}

function ResponsiveDialogDescription({ className, ...props }) {
  const isMobile = useIsMobile();
  const Comp = isMobile ? DrawerDescription : DialogDescription;
  return <Comp className={cn(className)} {...props} />;
}

function ResponsiveDialogFooter({ className, ...props }) {
  const isMobile = useIsMobile();
  const Comp = isMobile ? DrawerFooter : DialogFooter;
  return <Comp className={cn(isMobile && "px-0 pb-0", className)} {...props} />;
}

function ResponsiveDialogClose({ ...props }) {
  const isMobile = useIsMobile();
  const Comp = isMobile ? DrawerClose : DialogClose;
  return <Comp {...props} />;
}

export {
  ResponsiveDialog,
  ResponsiveDialogTrigger,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogClose,
};
