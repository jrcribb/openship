import { cn } from "@keystone/utils/cn";
import { ChevronDown, X } from "lucide-react";
import { RiLoader2Fill } from "@remixicon/react";
import ReactSelect, { components } from "react-select";
import React from "react";

export { components as selectComponents } from "react-select";

const controlStyles = {
  base: "shadow-sm flex align-center wrap justify-between rounded-md border border-input bg-muted/40 px-1.5 py-1 ring-offset-background",
  focus: "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  nonFocus: "disabled:cursor-not-allowed disabled:opacity-50",
};

const placeholderStyles = "col-start-1 col-end-3 row-start-1 row-end-2 text-muted-foreground pl-1";
const selectInputStyles = "inline-grid [grid-template-columns:min-content_auto] col-start-1 col-end-3 row-start-1 row-end-2 pl-1 py-0.5";
const singleValueContainerStyles = "items-center flex grid flex-1 flex-wrap";
const multiValueContainerStyles = "flex items-center flex-1 flex-wrap gap-1";
const singleValueStyles = "col-start-1 col-end-3 row-start-1 row-end-2 leading-7 ml-1 break-words";
const multiValueStyles = "shadow-sm overflow-hidden flex min-w-0 border-[1.5px] bg-background rounded-md items-center pl-2 gap-1 mr-1";
const multiValueLabelStyles = "pr-1 leading-6 text-sm";
const multiValueRemoveStyles = "border-l-[1.5px] hover:bg-zinc-50 dark:bg-zinc-500/10 text-zinc-500 dark:text-zinc-600 dark:hover:bg-zinc-500/20";
const indicatorsContainerStyles = "items-center self-stretch flex flex-shrink-0 box-border";
const clearIndicatorStyles = "p-1 hover:bg-background border border-transparent hover:border-muted/90 text-muted-foreground rounded-md hover:text-foreground/50";
const indicatorSeparatorStyles = "bg-muted";
const dropdownIndicatorStyles = "p-1 hover:bg-background border border-transparent hover:border-muted/90 text-muted-foreground rounded-md hover:text-foreground/50";
const menuStyles = "border p-1 overflow-hidden z-10 mt-2 top-full absolute w-full box-border rounded-md border bg-popover shadow-md";
const noOptionsMessageStyles = "text-muted-foreground py-2 px-5 bg-background border border-dashed border-input rounded-sm";

const optionStyles = {
  base: "text-zinc-900 dark:text-zinc-200 relative rounded-sm cursor-pointer flex w-full items-center pr-2 py-2 pl-4",
  focus: "bg-zinc-50 dark:bg-zinc-700",
  selected: "font-bold bg-zinc-100 dark:bg-zinc-800",
};

const LoadingIndicator = () => {
  return (
    <RiLoader2Fill
      className="size-5 shrink-0 animate-spin"
      aria-hidden="true"
    />
  );
};

const ClearIndicator = (props) => {
  return (
    <components.ClearIndicator {...props}>
      <X strokeWidth={2.5} className="w-5 h-5 p-0.5" />
    </components.ClearIndicator>
  );
};

const DropdownIndicator = (props) => {
  return (
    <components.DropdownIndicator {...props}>
      <ChevronDown strokeWidth={2.5} className="w-5 h-5 p-0.5" />
    </components.DropdownIndicator>
  );
};

const MultiValueRemove = (props) => {
  return (
    <components.MultiValueRemove {...props}>
      <X strokeWidth={2.5} className="w-6 h-6 py-[5px]" />
    </components.MultiValueRemove>
  );
};

const styleProxy = new Proxy(
  {},
  {
    get: (target, propKey) => {
      return target[propKey] ? target[propKey] : () => {};
    },
  }
);

export function Select({
  id,
  onChange,
  value,
  className,
  portalMenu,
  styles,
  ...props
}) {
  return (
    <ReactSelect
      inputId={id}
      value={value}
      onChange={(value) => {
        if (!value) {
          onChange(null);
        } else {
          onChange(value);
        }
      }}
      {...props}
      isMulti={false}
      unstyled
      classNames={{
        container: () => "relative",
        control: ({ isFocused }) =>
          cn(
            isFocused ? controlStyles.focus : controlStyles.nonFocus,
            controlStyles.base
          ),
        placeholder: () => placeholderStyles,
        input: () => selectInputStyles,
        valueContainer: () => singleValueContainerStyles,
        singleValue: () => singleValueStyles,
        multiValue: () => multiValueStyles,
        multiValueLabel: () => multiValueLabelStyles,
        multiValueRemove: () => multiValueRemoveStyles,
        indicatorsContainer: () => indicatorsContainerStyles,
        clearIndicator: () => clearIndicatorStyles,
        indicatorSeparator: () => indicatorSeparatorStyles,
        dropdownIndicator: () => dropdownIndicatorStyles,
        menu: () => menuStyles,
        option: ({ isFocused, isSelected }) =>
          cn(
            isFocused && optionStyles.focus,
            isSelected && optionStyles.selected,
            optionStyles.base
          ),
        noOptionsMessage: () => noOptionsMessageStyles,
      }}
      styles={{
        ...styleProxy,
        menuPortal: (defaultStyles) => ({
          ...defaultStyles,
          zIndex: 9999,
        }),
        menu: (defaultStyles) => ({
          ...defaultStyles,
          zIndex: 9999,
        }),
        singleValue: (defaultStyles) => ({
          ...defaultStyles,
          whiteSpace: "normal",
        }),
        input: (defaultStyles) => ({
          ...defaultStyles,
          whiteSpace: "normal",
        }),
      }}
      components={{
        LoadingIndicator,
        ClearIndicator,
        DropdownIndicator,
      }}
    />
  );
}

export function MultiSelect({
  id,
  onChange,
  value,
  className,
  portalMenu,
  styles,
  ...props
}) {
  return (
    <ReactSelect
      inputId={id}
      value={value}
      onChange={(value) => {
        if (!value) {
          onChange([]);
        } else if (Array.isArray(value)) {
          onChange(value);
        } else {
          onChange([value]);
        }
      }}
      {...props}
      isMulti
      unstyled
      classNames={{
        container: () => "relative",
        control: ({ isFocused }) =>
          cn(
            isFocused ? controlStyles.focus : controlStyles.nonFocus,
            controlStyles.base
          ),
        placeholder: () => placeholderStyles,
        input: () => selectInputStyles,
        valueContainer: ({ hasValue }) =>
          cn(hasValue ? multiValueContainerStyles : singleValueContainerStyles),
        singleValue: () => singleValueStyles,
        multiValue: () => multiValueStyles,
        multiValueLabel: () => multiValueLabelStyles,
        multiValueRemove: () => multiValueRemoveStyles,
        indicatorsContainer: () => indicatorsContainerStyles,
        clearIndicator: () => clearIndicatorStyles,
        indicatorSeparator: () => indicatorSeparatorStyles,
        dropdownIndicator: () => dropdownIndicatorStyles,
        menu: () => menuStyles,
        option: ({ isFocused, isSelected }) =>
          cn(
            isFocused && optionStyles.focus,
            isSelected && optionStyles.selected,
            optionStyles.base
          ),
        noOptionsMessage: () => noOptionsMessageStyles,
      }}
      styles={styleProxy}
      components={{
        LoadingIndicator,
        MultiValueRemove,
        ClearIndicator,
        DropdownIndicator,
        Control: CustomValueContainer,
      }}
    />
  );
}

const CustomValueContainer = ({ children, ...props }) => {
  return (
    <components.Control {...props}>
      <div className="flex flex-wrap gap-1 max-h-72 overflow-y-auto">{children[0]}</div>
      {children[1]}
    </components.Control>
  );
};