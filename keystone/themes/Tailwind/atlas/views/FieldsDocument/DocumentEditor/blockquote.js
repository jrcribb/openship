import { Fragment, useMemo } from "react";
import { Editor, Node, Path, Range, Transforms } from "slate";

import { IconBase } from "./Toolbar";
import { KeyboardInTooltip, ToolbarButton } from "./primitives";
import { isElementActive } from "./utils";
import { useToolbarState } from "./toolbar-state";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../primitives/default/ui/tooltip";

export const insertBlockquote = (editor) => {
  const isActive = isElementActive(editor, "blockquote");
  if (isActive) {
    Transforms.unwrapNodes(editor, {
      match: (node) => node.type === "blockquote",
    });
  } else {
    Transforms.wrapNodes(editor, {
      type: "blockquote",
      children: [],
    });
  }
};

function getDirectBlockquoteParentFromSelection(editor) {
  if (!editor.selection)
    return {
      isInside: false,
    };
  const [, parentPath] = Editor.parent(editor, editor.selection);
  if (!parentPath.length) {
    return {
      isInside: false,
    };
  }
  const [maybeBlockquoteParent, maybeBlockquoteParentPath] = Editor.parent(
    editor,
    parentPath
  );
  const isBlockquote = maybeBlockquoteParent.type === "blockquote";
  return isBlockquote
    ? {
        isInside: true,
        path: maybeBlockquoteParentPath,
      }
    : {
        isInside: false,
      };
}

export function withBlockquote(editor) {
  const { insertBreak, deleteBackward } = editor;
  editor.deleteBackward = (unit) => {
    if (editor.selection) {
      const parentBlockquote = getDirectBlockquoteParentFromSelection(editor);
      if (
        parentBlockquote.isInside &&
        Range.isCollapsed(editor.selection) &&
        // the selection is at the start of the paragraph
        editor.selection.anchor.offset === 0 &&
        // it's the first paragraph in the panel
        editor.selection.anchor.path[
          editor.selection.anchor.path.length - 2
        ] === 0
      ) {
        Transforms.unwrapNodes(editor, {
          match: (node) => node.type === "blockquote",
          split: true,
        });
        return;
      }
    }
    deleteBackward(unit);
  };
  editor.insertBreak = () => {
    const panel = getDirectBlockquoteParentFromSelection(editor);
    if (editor.selection && panel.isInside) {
      const [node, nodePath] = Editor.node(editor, editor.selection);
      if (Path.isDescendant(nodePath, panel.path) && Node.string(node) === "") {
        Transforms.unwrapNodes(editor, {
          match: (node) => node.type === "blockquote",
          split: true,
        });
        return;
      }
    }
    insertBreak();
  };

  return editor;
}

export const BlockquoteElement = ({ attributes, children }) => {
  return (
    <blockquote
      className="border-l-4 border-blue-200 my-0 py-0 px-6"
      {...attributes}
    >
      {children}
    </blockquote>
  );
};

const BlockquoteButton = ({ attrs }) => {
  const {
    editor,
    blockquote: { isDisabled, isSelected },
  } = useToolbarState();
  return useMemo(
    () => (
      <ToolbarButton
        isSelected={isSelected}
        isDisabled={isDisabled}
        onMouseDown={(event) => {
          event.preventDefault();
          insertBlockquote(editor);
        }}
        {...attrs}
      >
        <QuoteIcon />
      </ToolbarButton>
    ),
    [editor, attrs, isDisabled, isSelected]
  );
};
export const blockquoteButton = (
  <Tooltip>
    <TooltipTrigger>
      <BlockquoteButton />
    </TooltipTrigger>
    <TooltipContent>
      <Fragment>
        Quote<KeyboardInTooltip>{"> "}</KeyboardInTooltip>
      </Fragment>
    </TooltipContent>
  </Tooltip>
);

const QuoteIcon = () => (
  <IconBase>
    <path d="M11.3031 2C9.83843 2 8.64879 3.22321 8.64879 4.73171C8.64879 6.23928 9.83843 7.46342 11.3031 7.46342C13.8195 7.46342 12.3613 12.2071 9.18767 12.7012C9.03793 12.7239 8.90127 12.7995 8.80243 12.9143C8.70358 13.029 8.64908 13.1754 8.64879 13.3268C8.64879 13.7147 8.99561 14.0214 9.37973 13.9627C15.148 13.0881 17.1991 2.00093 11.3031 2.00093V2ZM3.65526 2C2.18871 2 1 3.22228 1 4.73171C1 6.23835 2.18871 7.46155 3.65526 7.46155C6.17067 7.46155 4.71252 12.2071 1.53888 12.7012C1.3893 12.7239 1.25277 12.7993 1.15394 12.9139C1.05511 13.0285 1.00051 13.1746 1 13.3259C1 13.7137 1.34682 14.0205 1.73001 13.9617C7.50016 13.0872 9.55128 2 3.65526 2Z" />
  </IconBase>
);
