import { ReactEditor, useFocused, useSelected } from "slate-react";
import { Editor, Node, Range, Transforms, Text } from "slate";
import { forwardRef, memo, useEffect, useMemo, useState } from "react";

import {
  InlineDialog,
  ToolbarButton,
  ToolbarGroup,
  ToolbarSeparator,
} from "./primitives";
import {
  EditorAfterButIgnoringingPointsWithNoContent,
  isElementActive,
  useElementWithSetNodes,
  useForceValidation,
  useStaticEditor,
} from "./utils";
import {
  getAncestorComponentChildFieldDocumentFeatures,
  useToolbarState,
} from "./toolbar-state";
import { useEventCallback } from "./utils";
import { isValidURL } from "./isValidURL";
import { isInlineContainer } from ".";
import { ExternalLinkIcon, LinkIcon, Trash2Icon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../primitives/default/ui/tooltip";

const isLinkActive = (editor) => {
  return isElementActive(editor, "link");
};

export const wrapLink = (editor, url) => {
  if (isLinkActive(editor)) {
    Transforms.unwrapNodes(editor, { match: (n) => n.type === "link" });
    return;
  }

  const { selection } = editor;
  const isCollapsed = selection && Range.isCollapsed(selection);

  if (isCollapsed) {
    Transforms.insertNodes(editor, {
      type: "link",
      href: url,
      children: [{ text: url }],
    });
  } else {
    Transforms.wrapNodes(
      editor,
      {
        type: "link",
        href: url,
        children: [{ text: "" }],
      },
      { split: true }
    );
  }
};

export const LinkElement = ({
  attributes,
  children,
  element: __elementForGettingPath,
}) => {
  const editor = useStaticEditor();
  const [currentElement, setNode] = useElementWithSetNodes(
    editor,
    __elementForGettingPath
  );
  const href = currentElement.href;

  const selected = useSelected();
  const focused = useFocused();
  const [focusedInInlineDialog, setFocusedInInlineDialog] = useState(false);
  // we want to show the link dialog when the editor is focused and the link element is selected
  // or when the input inside the dialog is focused so you would think that would look like this:
  // (selected && focused) || focusedInInlineDialog
  // this doesn't work though because the blur will happen before the focus is inside the inline dialog
  // so this component would be rendered and focused would be false so the input would be removed so it couldn't be focused
  // to fix this, we delay our reading of the updated `focused` value so that we'll still render the dialog
  // immediately after the editor is blurred but before the input has been focused
  const [delayedFocused, setDelayedFocused] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => {
      setDelayedFocused(focused);
    }, 0);
    return () => {
      clearTimeout(id);
    };
  }, [focused]);
  const [localForceValidation, setLocalForceValidation] = useState(false);
  const unlink = useEventCallback(() => {
    Transforms.unwrapNodes(editor, {
      at: ReactEditor.findPath(editor, __elementForGettingPath),
    });
  });
  const forceValidation = useForceValidation();
  const showInvalidState = isValidURL(href)
    ? false
    : forceValidation || localForceValidation;
  return (
    <span {...attributes} className="relative inline-block">
      <a href={href}>{children}</a>
      {((selected && delayedFocused) || focusedInInlineDialog) && (
        <InlineDialog
          onFocus={() => {
            setFocusedInInlineDialog(true);
          }}
          onBlur={() => {
            setFocusedInInlineDialog(false);
            setLocalForceValidation(true);
          }}
        >
          <div className="flex flex-col">
            <ToolbarGroup>
              <input
                className="text-sm w-[240px]"
                value={href}
                onChange={(event) => {
                  setNode({ href: event.target.value });
                }}
              />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <ToolbarButton
                      as="a"
                      onMouseDown={(event) => {
                        event.preventDefault();
                      }}
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      variant="action"
                      {...attrs}
                    >
                      {externalLinkIcon}
                    </ToolbarButton>
                  </TooltipTrigger>
                  <TooltipContent>Open link in new tab</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {separator}
              <UnlinkButton onUnlink={unlink} />
            </ToolbarGroup>
            {showInvalidState && (
              <span className="text-red-600 dark:text-red-700 text-sm">
                Please enter a valid URL
              </span>
            )}
          </div>
        </InlineDialog>
      )}
    </span>
  );
};

const separator = <ToolbarSeparator />;
const externalLinkIcon = <ExternalLinkIcon size="small" />;

const UnlinkButton = memo(function UnlinkButton({ onUnlink }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <ToolbarButton
            variant="destructive"
            onMouseDown={(event) => {
              event.preventDefault();
              onUnlink();
            }}
            {...attrs}
          >
            <Trash2Icon size="small" />
          </ToolbarButton>
        </TooltipTrigger>
        <TooltipContent>Unlink</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

let linkIcon = <LinkIcon size="small" />;

const LinkButton = forwardRef(function LinkButton(props, ref) {
  const {
    editor,
    links: { isDisabled, isSelected },
  } = useToolbarState();
  return useMemo(
    () => (
      <ToolbarButton
        ref={ref}
        isDisabled={isDisabled}
        isSelected={isSelected}
        onMouseDown={(event) => {
          event.preventDefault();
          wrapLink(editor, "");
        }}
        {...props}
      >
        {linkIcon}
      </ToolbarButton>
    ),
    [isSelected, isDisabled, editor, props, ref]
  );
});

export const linkButton = (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger>
        <LinkButton />
      </TooltipTrigger>
      <TooltipContent>Link</TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

const markdownLinkPattern = /(^|\s)\[(.+?)\]\((\S+)\)$/;

export function withLink(editorDocumentFeatures, componentBlocks, editor) {
  const { insertText, isInline, normalizeNode } = editor;

  editor.isInline = (element) => {
    return element.type === "link" ? true : isInline(element);
  };

  if (editorDocumentFeatures.links) {
    editor.insertText = (text) => {
      insertText(text);
      if (text !== ")" || !editor.selection) return;
      const startOfBlock = Editor.start(
        editor,
        Editor.above(editor, {
          match: (node) => Editor.isBlock(editor, node),
        })[1]
      );

      const startOfBlockToEndOfShortcutString = Editor.string(editor, {
        anchor: editor.selection.anchor,
        focus: startOfBlock,
      });
      const match = markdownLinkPattern.exec(startOfBlockToEndOfShortcutString);
      if (!match) return;
      const ancestorComponentChildFieldDocumentFeatures =
        getAncestorComponentChildFieldDocumentFeatures(
          editor,
          editorDocumentFeatures,
          componentBlocks
        );
      if (
        ancestorComponentChildFieldDocumentFeatures?.documentFeatures.links ===
        false
      ) {
        return;
      }
      const [, maybeWhitespace, linkText, href] = match;
      // by doing this, the insertText(')') above will happen in a different undo than the link replacement
      // so that means that when someone does an undo after this
      // it will undo to the state of "[content](link)" rather than "[content](link" (note the missing closing bracket)
      editor.history.undos.push([]);
      const startOfShortcut =
        match.index === 0
          ? startOfBlock
          : EditorAfterButIgnoringingPointsWithNoContent(editor, startOfBlock, {
              distance: match.index,
            });
      const startOfLinkText = EditorAfterButIgnoringingPointsWithNoContent(
        editor,
        startOfShortcut,
        {
          distance: maybeWhitespace === "" ? 1 : 2,
        }
      );
      const endOfLinkText = EditorAfterButIgnoringingPointsWithNoContent(
        editor,
        startOfLinkText,
        {
          distance: linkText.length,
        }
      );

      Transforms.delete(editor, {
        at: { anchor: endOfLinkText, focus: editor.selection.anchor },
      });
      Transforms.delete(editor, {
        at: { anchor: startOfShortcut, focus: startOfLinkText },
      });

      Transforms.wrapNodes(
        editor,
        { type: "link", href, children: [] },
        {
          at: { anchor: editor.selection.anchor, focus: startOfShortcut },
          split: true,
        }
      );
      const nextNode = Editor.next(editor);
      if (nextNode) {
        Transforms.select(editor, nextNode[1]);
      }
    };
  }

  editor.normalizeNode = ([node, path]) => {
    if (node.type === "link") {
      if (Node.string(node) === "") {
        Transforms.unwrapNodes(editor, { at: path });
        return;
      }
      for (const [idx, child] of node.children.entries()) {
        if (child.type === "link") {
          // links cannot contain links
          Transforms.unwrapNodes(editor, { at: [...path, idx] });
          return;
        }
      }
    }
    if (isInlineContainer(node)) {
      let lastMergableLink = null;
      for (const [idx, child] of node.children.entries()) {
        if (
          child.type === "link" &&
          child.href === lastMergableLink?.node.href
        ) {
          const firstLinkPath = [...path, lastMergableLink.index];
          const secondLinkPath = [...path, idx];
          const to = [...firstLinkPath, lastMergableLink.node.children.length];
          // note this is going in reverse, js doesn't have double-ended iterators so it's a for(;;)
          for (let i = child.children.length - 1; i >= 0; i--) {
            const childPath = [...secondLinkPath, i];
            Transforms.moveNodes(editor, { at: childPath, to });
          }
          Transforms.removeNodes(editor, { at: secondLinkPath });
          return;
        }
        if (!Text.isText(child) || child.text !== "") {
          lastMergableLink = null;
        }
        if (child.type === "link") {
          lastMergableLink = { index: idx, node: child };
        }
      }
    }
    normalizeNode([node, path]);
  };

  return editor;
}
