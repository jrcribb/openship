import { createElement, useState } from "react"
import { Editor, Range, Text } from "slate"
import { Slate, ReactEditor, withReact } from "slate-react"

import React from "react"
import { act, render } from "@testing-library/react"
import { diff } from "jest-diff"
import prettyFormat, { plugins } from "pretty-format"
import { DocumentEditorEditable } from ".."
import { createDocumentEditor } from "../editor-shared"

export { __jsx as jsx } from "./jsx/namespace"
import { validateDocumentStructure } from "../../structure-validation"
import { ToolbarStateProvider } from "../toolbar-state"
import { createToolbarState } from "../toolbar-state-shared"
import { validateAndNormalizeDocument } from "../../validation"

const oldConsoleError = console.error

console.error = (...stuff) => {
  if (typeof stuff[0] === "string") {
    if (stuff[0].includes("validateDOMNesting")) {
      return
    }
    // _somehow_ act is being used wrong
    // it's not really worth digging into imo
    // these tests aren't about thoroughly testing the rendering of the editor
    // they're just a quick it doesn't crash
    if (stuff[0].includes("inside a test was not wrapped in act")) {
      return
    }
  }
  oldConsoleError(...stuff)
  console.log(
    "console.error was called, either add an exception for this kind of call or fix the problem"
  )

  // i very much don't like calling process.exit here
  // but it seems to be the only way to get Jest to fail a test suite
  // without throwing an error that is caught by Jest
  // re why not just throw an error: console.error might be called
  // in a promise that isn't handled for whatever reason
  // so we can't know that throwing an error will actually fail the tests
  // (idk why Jest doesn't fail on unhandled rejections)

  // for whoever is trying to debug why this is failing here:
  // you should remove the process.exit call and replace it with a throw
  // and then look for unhandled rejections or thrown errors
  process.exit(1)
}

function formatEditor(editor) {
  return prettyFormat(editor, {
    plugins: [plugins.ReactElement, editorSerializer]
  })
}

expect.extend({
  toEqualEditor(received, expected) {
    const options = {
      comment: "Slate Editor equality",
      isNot: this.isNot,
      promise: this.promise
    }
    const receivedConfig = received.__config
    validateAndNormalizeDocument(
      received.children,
      receivedConfig.documentFeatures,
      receivedConfig.componentBlocks,
      receivedConfig.relationships
    )

    const expectedConfig = expected.__config
    validateAndNormalizeDocument(
      expected.children,
      expectedConfig.documentFeatures,
      expectedConfig.componentBlocks,
      expectedConfig.relationships
    )

    const pass =
      this.equals(received.children, expected.children) &&
      this.equals(received.selection, expected.selection) &&
      this.equals(Editor.marks(received), Editor.marks(expected))

    const message = pass
      ? () => {
          const formattedReceived = formatEditor(received)
          const formattedExpected = formatEditor(expected)

          return (
            this.utils.matcherHint(
              "toEqualEditor",
              undefined,
              undefined,
              options
            ) +
            "\n\n" +
            `Expected: not ${this.utils.printExpected(formattedExpected)}\n` +
            `Received: ${this.utils.printReceived(formattedReceived)}`
          )
        }
      : () => {
          const formattedReceived = formatEditor(received)
          const formattedExpected = formatEditor(expected)

          const diffString = diff(formattedExpected, formattedReceived, {
            expand: this.expand
          })
          return (
            this.utils.matcherHint(
              "toEqualEditor",
              undefined,
              undefined,
              options
            ) +
            "\n\n" +
            (diffString && diffString.includes("- Expect")
              ? `Difference:\n\n${diffString}`
              : `Expected: ${this.utils.printExpected(formattedExpected)}\n` +
                `Received: ${this.utils.printReceived(formattedReceived)}`)
          )
        }

    return { actual: received, message, pass }
  }
})
export const defaultDocumentFeatures = {
  formatting: {
    alignment: { center: true, end: true },
    blockTypes: { blockquote: true, code: true },
    headingLevels: [1, 2, 3, 4, 5, 6],
    inlineMarks: {
      bold: true,
      code: true,
      italic: true,
      keyboard: true,
      strikethrough: true,
      subscript: true,
      superscript: true,
      underline: true
    },
    listTypes: { ordered: true, unordered: true },
    softBreaks: true
  },
  dividers: true,
  links: true,
  layouts: [[1], [1, 1], [1, 1, 1], [1, 2, 1]]
}

function EditorComp({
  editor,
  componentBlocks,
  documentFeatures,
  relationships
}) {
  const [val, setVal] = useState(editor.children)
  return (
    <Slate editor={editor} initialValue={val} onChange={setVal}>
      <ToolbarStateProvider
        componentBlocks={componentBlocks}
        editorDocumentFeatures={documentFeatures}
        relationships={relationships}
      >
        <DocumentEditorEditable
          // the default implementation of scrollSelectionIntoView crashes in JSDOM for some reason
          // so we just do nothing
          scrollSelectionIntoView={() => {}}
        />
      </ToolbarStateProvider>
    </Slate>
  )
}

export function makeEditor(
  node,
  {
    documentFeatures = defaultDocumentFeatures,
    componentBlocks = {},
    normalization = "disallow-non-normalized",
    relationships = {},
    skipRenderingDOM
  } = {}
) {
  if (!Editor.isEditor(node)) {
    throw new Error("Unexpected non-editor passed to makeEditor")
  }
  const editor = createDocumentEditor(
    documentFeatures,
    componentBlocks,
    relationships,
    {
      ReactEditor,
      withReact
    }
  )

  // for validation
  editor.__config = {
    documentFeatures,
    componentBlocks,
    relationships
  }

  validateDocumentStructure(editor.children)

  // just a smoke test for the toolbar state
  createToolbarState(editor, componentBlocks, documentFeatures)
  const { onChange } = editor
  editor.onChange = () => {
    act(() => {
      onChange()
    })
  }

  editor.children = node.children
  editor.selection = node.selection
  editor.marks = node.marks
  // a note about editor.marks, it's essentially a cache for Editor.marks/
  // a stateful bit for when calling removeMark/addMark
  // calling Editor.marks will get the _actual_ marks that will be applied
  // so editor.marks should basically never be read
  // but editor.marks will come from the JSX here
  // and we want tests to explicitly specify what the marks should be
  const marks = Editor.marks(editor)
  if (editor.marks || (marks && Object.keys(marks).length)) {
    expect(marks).toEqual(editor.marks)
  }
  // we need to make one of our editors because toEqualEditor expects the __config stuff to exist
  // and if it fails, the snapshot serializer will be called to diff them which also expects __config
  const makeEditorForComparison = node =>
    makeEditor(node, {
      componentBlocks,
      documentFeatures,
      isShiftPressedRef: { current: false },
      normalization: "skip",
      relationships,
      skipRenderingDOM: true
    })
  if (normalization === "normalize") {
    Editor.normalize(editor, { force: true })
    expect(editor).not.toEqual(makeEditorForComparison(node))
  }
  if (normalization === "disallow-non-normalized") {
    Editor.normalize(editor, { force: true })
    expect(makeEditorForComparison(node)).toEqualEditor(editor)
  }

  if (skipRenderingDOM !== true) {
    // this serves two purposes:
    // - a smoke test to make sure the ui doesn't throw from any of the actions in the tests
    // - so that things like ReactEditor.focus and etc. can be called
    const { container } = render(
      <EditorComp
        editor={editor}
        componentBlocks={componentBlocks}
        documentFeatures={documentFeatures}
        relationships={relationships}
      />
    )

    editor.container = container
  }
  return editor
}

// we're converting the slate tree to react elements because Jest
// knows how to pretty-print react elements in snapshots
function nodeToReactElement(editor, node, selection, path) {
  if (Text.isText(node)) {
    const { text, ...marks } = node
    if (selection) {
      const stringifiedPath = JSON.stringify(path)
      const isAnchorInCurrentText =
        JSON.stringify(selection.anchor.path) === stringifiedPath
      const isFocusInCurrentText =
        JSON.stringify(selection.focus.path) === stringifiedPath

      if (isAnchorInCurrentText && isFocusInCurrentText) {
        if (selection.anchor.offset === selection.focus.offset) {
          return createElement("text", {
            children: [
              text.slice(0, selection.focus.offset),
              createElement("cursor"),
              text.slice(selection.focus.offset)
            ].filter(x => x),
            ...marks
          })
        }
        const [startPoint, endPoint] = Range.edges(selection)
        const isBackward = Range.isBackward(selection)
        return createElement("text", {
          children: [
            text.slice(0, startPoint.offset),
            createElement(isBackward ? "focus" : "anchor"),
            text.slice(startPoint.offset, endPoint.offset),
            createElement(isBackward ? "anchor" : "focus"),
            text.slice(endPoint.offset)
          ].filter(x => x),
          ...marks
        })
      }
      if (isAnchorInCurrentText || isFocusInCurrentText) {
        const point = isAnchorInCurrentText ? selection.anchor : selection.focus
        return createElement("text", {
          children: [
            text.slice(0, point.offset),
            createElement(isAnchorInCurrentText ? "anchor" : "focus"),
            text.slice(point.offset)
          ].filter(x => x),
          ...marks
        })
      }
    }
    return createElement("text", {
      // we want to show empty text nodes as <text />
      children: text === "" ? undefined : text,
      ...marks
    })
  }
  const children = node.children.map((x, i) =>
    nodeToReactElement(editor, x, selection, path.concat(i))
  )
  if (Editor.isEditor(node)) {
    const config = editor.__config
    validateAndNormalizeDocument(
      node.children,
      config.documentFeatures,
      config.componentBlocks,
      config.relationships
    )
    const marks = Editor.marks(node)

    return createElement("editor", {
      children,
      ...(marks && Object.keys(marks).length ? { marks } : {})
    })
  }
  const { type, ...restNode } = node
  const computedData = {}
  if (editor.isVoid(node)) {
    computedData["@@isVoid"] = true
  }
  if (editor.isInline(node)) {
    computedData["@@isInline"] = true
  }
  if (type !== undefined) {
    return createElement(type, { ...restNode, ...computedData, children })
  }
  // @ts-expect-error TODO: can `type` actually be undefined?
  return createElement("element", { ...node, ...computedData, children })
}

const editorSerializer = {
  test(val) {
    return Editor.isEditor(val)
  },
  serialize(val, config, indentation, depth, refs, printer) {
    return printer(
      nodeToReactElement(val, val, val.selection, []),
      config,
      indentation,
      depth,
      refs
    )
  }
}

expect.addSnapshotSerializer(editorSerializer)
