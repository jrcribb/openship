import { Fragment, cloneElement, useMemo, useState } from "react";
import { useList } from "@keystone/keystoneProvider";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "../../primitives/default/ui/button";
import {
  ChevronRightIcon,
  ChevronLeftIcon,
  ListFilterIcon,
  PlusIcon,
} from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "../../primitives/default/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
} from "../../primitives/default/ui/dropdown-menu";
import { ScrollArea, ScrollBar } from "../../primitives/default/ui/scroll-area";
import { Separator } from "../../primitives/default/ui/separator";

export function FilterAdd({ listKey, filterableFields, children }) {
  const [isOpen, setIsOpen] = useState(false);

  const DefaultTrigger = () => (
    <button
      type="button"
      className="flex gap-1.5 pr-2 pl-2 tracking-wider items-center text-xs shadow-sm border p-[.15rem] font-medium text-zinc-600 bg-white dark:bg-zinc-800 rounded-md hover:bg-zinc-100 hover:text-blue-700 focus:z-10 focus:ring-2 focus:ring-blue-700 focus:text-blue-700 dark:border-zinc-600 dark:text-zinc-300 dark:hover:text-white dark:hover:bg-zinc-600 dark:focus:ring-blue-500 dark:focus:text-white"
    >
      <PlusIcon size={13} className="stroke-muted-foreground" />
      FILTER
    </button>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={() => setIsOpen(true)}>
        {children || <DefaultTrigger />}
      </DropdownMenuTrigger>
      {isOpen && (
        <FilterAddPopoverContent
          onClose={() => setIsOpen(false)}
          listKey={listKey}
          filterableFields={filterableFields}
        />
      )}
    </DropdownMenu>
  );
}

function FilterAddPopoverContent({ onClose, listKey, filterableFields }) {
  const list = useList(listKey);
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Create a query object that behaves like the old query object
  const query = {};
  for (let [key, value] of searchParams.entries()) {
    query[key] = value;
  }
  const router = useRouter();
  const fieldsWithFilters = useMemo(() => {
    const fieldsWithFilters = {};
    Object.keys(list.fields).forEach((fieldPath) => {
      const field = list.fields[fieldPath];
      if (filterableFields.has(fieldPath) && field.controller.filter) {
        fieldsWithFilters[fieldPath] = field;
      }
    });
    return fieldsWithFilters;
  }, [list.fields, filterableFields]);
  const filtersByFieldThenType = useMemo(() => {
    const filtersByFieldThenType = {};
    Object.keys(fieldsWithFilters).forEach((fieldPath) => {
      const field = fieldsWithFilters[fieldPath];
      let hasUnusedFilters = false;
      const filters = {};
      Object.keys(field.controller.filter.types).forEach((filterType) => {
        if (query[`!${fieldPath}_${filterType}`] === undefined) {
          hasUnusedFilters = true;
          filters[filterType] = field.controller.filter.types[filterType].label;
        }
      });
      if (hasUnusedFilters) {
        filtersByFieldThenType[fieldPath] = filters;
      }
    });
    return filtersByFieldThenType;
  }, [query, fieldsWithFilters]);
  const [state, setState] = useState({ kind: "selecting-field" });

  const handleSelectField = (fieldPath) => {
    const filterType = Object.keys(filtersByFieldThenType[fieldPath])[0];
    setState({
      kind: "filter-value",
      fieldPath,
      filterType,
      filterValue:
        fieldsWithFilters[fieldPath].controller.filter.types[filterType]
          .initialValue,
    });
  };

  return (
    <DropdownMenuContent align="start" className="w-[200px]">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (state.kind === "filter-value") {
            router.push(
              pathname +
                "?" +
                new URLSearchParams({
                  ...query,
                  [`!${state.fieldPath}_${state.filterType}`]: JSON.stringify(
                    state.filterValue
                  ),
                })
            );
            onClose();
          }
        }}
      >
        <div className="flex justify-between items-center px-1">
          {state.kind !== "selecting-field" && (
            <Button
              onClick={() => {
                setState({ kind: "selecting-field" });
              }}
              variant="outline"
              size="icon"
              className="[&_svg]:size-4 w-6 h-6"
            >
              <div className="sr-only">Back</div>
              <ChevronLeftIcon />
            </Button>
          )}
          <DropdownMenuLabel>
            {(() => {
              switch (state.kind) {
                case "selecting-field": {
                  return "Filter";
                }
                case "filter-value": {
                  return list.fields[state.fieldPath].label;
                }
              }
            })()}
          </DropdownMenuLabel>
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-[300px] overflow-y-auto">
          {state.kind === "selecting-field" &&
            Object.keys(filtersByFieldThenType).map((fieldPath) => (
              <button
                key={fieldPath}
                className="rounded-sm px-2 py-1.5 text-sm w-full text-left hover:bg-zinc-100 dark:hover:bg-zinc-900"
                onClick={() => handleSelectField(fieldPath)}
              >
                {list.fields[fieldPath].label}
              </button>
            ))}
          {state.kind === "filter-value" && (
            <Select
              onValueChange={(filterType) => {
                setState({
                  kind: "filter-value",
                  fieldPath: state.fieldPath,
                  filterValue:
                    fieldsWithFilters[state.fieldPath].controller.filter.types[
                      filterType
                    ].initialValue,
                  filterType: filterType,
                });
              }}
            >
              <SelectTrigger className="mb-2">
                <SelectValue>
                  {filtersByFieldThenType[state.fieldPath][state.filterType]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.keys(filtersByFieldThenType[state.fieldPath]).map(
                  (filterType) => (
                    <SelectItem key={filterType} value={filterType}>
                      {filtersByFieldThenType[state.fieldPath][filterType]}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          )}
          {state.kind == "filter-value" &&
            (() => {
              const { Filter } =
                fieldsWithFilters[state.fieldPath].controller.filter;
              return (
                <div className="pb-3">
                  <Filter
                    type={state.filterType}
                    value={state.filterValue}
                    onChange={(value) => {
                      setState((state) => ({
                        ...state,
                        filterValue: value,
                      }));
                    }}
                  />
                </div>
              );
            })()}
        </div>
        {state.kind == "filter-value" && (
          <>
            <DropdownMenuSeparator />
            <div className="flex justify-between p-1">
              <Button onClick={onClose} variant="outline" size="sm">
                Cancel
              </Button>
              <Button type="submit" size="sm">
                Apply
              </Button>
            </div>
          </>
        )}
      </form>
    </DropdownMenuContent>
  );
}
