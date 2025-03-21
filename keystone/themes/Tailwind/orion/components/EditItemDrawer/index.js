import { useKeystone, useList } from "@keystone/keystoneProvider";
import { Drawer } from "../Modals";
import { Fields } from "../Fields";
import { GraphQLErrorNotice } from "../GraphQLErrorNotice";
import { LoadingIcon } from "../LoadingIcon";
import {
  useMutation,
  gql,
  useQuery,
  useApolloClient,
} from "@keystone-6/core/admin-ui/apollo";
import { useState, useMemo, useCallback } from "react";
import {
  deserializeValue,
  makeDataGetter,
  useChangedFieldsAndDataForUpdate,
  useInvalidFields,
} from "@keystone-6/core/admin-ui/utils";
import { Button } from "@ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@ui/dialog";
import { useToasts } from "../Toast";
import { DrawerBase } from "../Modals/DrawerBase";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "../../primitives/default/ui/sheet";
import { ScrollArea } from "../../primitives/default/ui/scroll-area";
import { Badge } from "../../primitives/default/ui/badge";
import { Trash2, RotateCcw, Copy, Check } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../primitives/default/ui/tooltip";
import { cn } from "@keystone/utils/cn";

export const useDeleteItem = (listKey) => {
  const list = useList(listKey);
  const toasts = useToasts();
  const client = useApolloClient();

  const [deleteItem, { loading: deleteLoading, error: deleteError }] = useMutation(
    gql`mutation ($id: ID!) {
      ${list.gqlNames.deleteMutationName}(where: { id: $id }) {
        id
      }
    }`
  );

  const handleDelete = useCallback(async (itemId, itemLabel) => {
    try {
      await deleteItem({ variables: { id: itemId } });
      await client.refetchQueries({ include: "active" });
      toasts.addToast({
        title: itemLabel,
        message: `Deleted ${list.singular} item successfully`,
        tone: "positive",
      });
    } catch (err) {
      toasts.addToast({
        title: `Failed to delete ${list.singular} item: ${itemLabel}`,
        message: err.message,
        tone: "negative",
      });
    }
  }, [deleteItem, client, list, toasts]);

  return { handleDelete, deleteLoading, deleteError };
};

export const useUpdateItem = (listKey) => {
  const list = useList(listKey);
  const toasts = useToasts();
  const client = useApolloClient();

  const [update, { loading: updateLoading, error: updateError }] = useMutation(
    gql`
      mutation ($data: ${list.gqlNames.updateInputName}!, $id: ID!) {
        item: ${list.gqlNames.updateMutationName}(where: { id: $id }, data: $data) {
          id
        }
      }
    `
  );

  const handleUpdate = useCallback(async (itemId, data) => {
    try {
      await update({ variables: { data, id: itemId } });
      await client.refetchQueries({ include: "active" });
      toasts.addToast({
        title: `Updated ${list.singular}`,
        message: `Updated ${list.singular} item successfully`,
        tone: "positive",
      });
    } catch (error) {
      console.error(`Error updating item:`, error);
      toasts.addToast({
        title: `Failed to update ${list.singular}`,
        message: error.message,
        tone: "negative",
      });
    }
  }, [update, client, list, toasts]);

  return { handleUpdate, updateLoading, updateError };
};

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger>
          <Button
            variant="outline"
            className="h-7 flex items-center gap-2 rounded-none shadow-none last:rounded-e-lg focus-visible:z-10 disabled:opacity-100"
            onClick={handleCopy}
            aria-label={copied ? "Copied" : "Copy to clipboard"}
            disabled={copied}
          >
            <span className="truncate max-w-[80px] text-sm font-medium">ID: {text}</span>
            <div className="relative h-4 w-4">
              <div
                className={cn(
                  "absolute inset-0 transition-all",
                  copied ? "scale-100 opacity-100" : "scale-0 opacity-0"
                )}
              >
                <Check className="stroke-emerald-500" size={16} strokeWidth={2} aria-hidden="true" />
              </div>
              <div
                className={cn(
                  "absolute inset-0 transition-all",
                  copied ? "scale-0 opacity-0" : "scale-100 opacity-100"
                )}
              >
                <Copy size={16} strokeWidth={2} aria-hidden="true" />
              </div>
            </div>
          </Button>
        </TooltipTrigger>
        <TooltipContent className="px-2 py-1 text-xs">Click to copy</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function DeleteButton({ itemLabel, itemId, list, onClose, children }) {
  const { handleDelete, deleteLoading } = useDeleteItem(list.key);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  return (
    <Dialog open={isConfirmModalOpen} onOpenChange={setIsConfirmModalOpen}>
      <DialogTrigger asChild>
        {/* <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild> */}
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7 rounded-none shadow-none first:rounded-s-lg focus-visible:z-10"
                onClick={() => setIsConfirmModalOpen(true)}
              >
                <Trash2 className="stroke-red-500" size={16} strokeWidth={2} aria-hidden="true" />
              </Button>
            {/* </TooltipTrigger>
            <TooltipContent className="px-2 py-1 text-xs">Delete item</TooltipContent>
          </Tooltip>
        </TooltipProvider> */}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Delete Confirmation</DialogTitle>
        </DialogHeader>
        <div className="text-sm">
          Are you sure you want to delete <strong>{itemLabel}</strong>?
        </div>
        <DialogFooter className="mt-4">
          <DialogClose asChild>
            <Button
              variant="outline"
              onClick={() => setIsConfirmModalOpen(false)}
            >
              Close
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            isLoading={deleteLoading}
            onClick={async () => {
              await handleDelete(itemId, itemLabel);
              setIsConfirmModalOpen(false);
              if (onClose) onClose();
            }}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetChangesButton({ onReset, disabled }) {
  const [isConfirmModalOpen, setConfirmModalOpen] = useState(false);
  return (
    <Dialog open={isConfirmModalOpen} onOpenChange={setConfirmModalOpen}>
      <DialogTrigger asChild>
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                disabled={disabled}
                className="h-7 flex items-center gap-2 rounded-none shadow-none focus-visible:z-10 px-3"
              >
                <RotateCcw size={16} strokeWidth={2} aria-hidden="true" />
                <span className="text-sm">Reset</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent className="px-2 py-1 text-xs">Reset changes</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Reset Confirmation</DialogTitle>
        </DialogHeader>
        <text className="text-sm">Are you sure you want to reset changes?</text>
        <DialogFooter className="mt-4">
          <DialogClose asChild>
            <Button
              variant="outline"
              onClick={() => setConfirmModalOpen(false)}
            >
              Close
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={() => {
              onReset();
              setConfirmModalOpen(false);
            }}
          >
            Reset Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EditItemDrawer({ listKey, itemId, closeDrawer, open }) {
  const { createViewFieldModes } = useKeystone();
  const list = useList(listKey);
  const client = useApolloClient();
  const { handleUpdate, updateLoading, updateError } = useUpdateItem(listKey);

  const { data, error, loading } = useQuery(
    gql`
      query ($id: ID!) {
        item: ${list.gqlNames.itemQueryName}(where: { id: $id }) {
          id
          ${Object.keys(list.fields)
            .map((field) => list.fields[field].controller.graphqlSelection)
            .join("\n")}
        }
      }
    `,
    { variables: { id: itemId } }
  );

  const itemGetter = useMemo(
    () => makeDataGetter(data, error?.graphQLErrors).get("item"),
    [data, error]
  );

  const [state, setValue] = useState(() => ({
    value: deserializeValue(list.fields, itemGetter),
    item: itemGetter,
  }));

  if (data && state.item.data !== itemGetter.data) {
    setValue({
      value: deserializeValue(list.fields, itemGetter),
      item: itemGetter,
    });
  }

  const { changedFields, dataForUpdate } = useChangedFieldsAndDataForUpdate(
    list.fields,
    state.item,
    state.value
  );
  const invalidFields = useInvalidFields(list.fields, state.value);

  const handleSave = async () => {
    if (invalidFields.size === 0) {
      await handleUpdate(itemId, dataForUpdate);
      closeDrawer();
    }
  };

  const handleReset = () => {
    setValue({
      value: deserializeValue(list.fields, itemGetter),
      item: itemGetter,
    });
  };

  const refetchListQuery = async () => {
    await client.refetchQueries({
      include: "active",
    });
  };

  return (
    <Sheet
      onSubmit={handleSave}
      onClose={closeDrawer}
      onOpenChange={closeDrawer}
      width="narrow"
      open={open}
    >
      <SheetContent className="flex flex-col w-full sm:w-[540px]">
        <SheetHeader className="border-b">
          <SheetTitle className="flex flex-col gap-1">
            Edit {list.singular}
          </SheetTitle>
          <SheetDescription>
            <div className="flex flex-col gap-4 -mt-1 -mb-3">
              <span>
                Use this form to edit this item. Click save when you're done
              </span>
              <div className="inline-flex -space-x-px rounded-lg rtl:space-x-reverse">
                <DeleteButton
                  itemLabel={itemGetter.get("label").data || itemId}
                  itemId={itemId}
                  list={list}
                  onClose={async () => {
                    await refetchListQuery();
                    closeDrawer();
                  }}
                />
                <ResetChangesButton
                  onReset={handleReset}
                  disabled={!changedFields.size}
                />
                <CopyButton text={itemId} />
              </div>
            </div>
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="overflow-auto flex-grow">
          <div className="px-5 py-4">
            {createViewFieldModes.state === "error" && (
              <GraphQLErrorNotice
                networkError={
                  createViewFieldModes.error instanceof Error
                    ? createViewFieldModes.error
                    : undefined
                }
                errors={
                  createViewFieldModes.error instanceof Error
                    ? undefined
                    : createViewFieldModes.error
                }
              />
            )}
            {loading ? (
              <LoadingIcon label="Loading item data" />
            ) : (
              <>
                {updateError && (
                  <GraphQLErrorNotice
                    networkError={updateError?.networkError}
                    errors={updateError?.graphQLErrors}
                  />
                )}
                <Fields
                  fields={list.fields}
                  groups={list.groups}
                  fieldModes={
                    createViewFieldModes.state === "loaded"
                      ? createViewFieldModes.lists[listKey]
                      : null
                  }
                  value={state.value}
                  forceValidation={false}
                  invalidFields={invalidFields}
                  onChange={(getNewValue) => {
                    setValue((prev) => ({
                      ...prev,
                      value: getNewValue(prev.value),
                    }));
                  }}
                />
              </>
            )}
          </div>
        </ScrollArea>
        <SheetFooter className="border-t p-2">
          <SheetClose asChild>
            <Button
              variant="outline"
              onClick={() => {
                if (
                  !changedFields.size ||
                  window.confirm(
                    "There are unsaved changes, are you sure you want to exit?"
                  )
                ) {
                  closeDrawer();
                }
              }}
            >
              Cancel
            </Button>
          </SheetClose>
          <Button
            disabled={updateLoading || !changedFields.size}
            isLoading={updateLoading}
            onClick={handleSave}
          >
            Save Changes
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}