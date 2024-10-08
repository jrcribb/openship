// Tremor Raw Calendar [v0.0.0]

"use client"
import * as React from "react"
// import {
//   RiArrowLeftDoubleLine,
//   RiArrowLeftSLine,
//   RiArrowRightDoubleLine,
//   RiArrowRightSLine
// } from "@remixicon/react"
import { addYears, format, isSameMonth } from "date-fns"
import {
  DayPicker,
  useDayPicker,
  useDayRender,
  useNavigation
} from "react-day-picker"


import { cn } from "@keystone/utils/cn"
import { ArrowRight, ArrowLeft } from "lucide-react"
import { focusRing } from "./utils"

const NavigationButton = React.forwardRef(
  ({ onClick, icon, disabled, ...props }, forwardedRef) => {
    const Icon = icon
    return (
      <button
        ref={forwardedRef}
        type="button"
        disabled={disabled}
        className={cn(
          "flex size-8 shrink-0 select-none items-center justify-center rounded border p-1 outline-none transition sm:size-[30px]",
          // text color
          "text-zinc-600 hover:text-zinc-800",
          "dark:text-zinc-400 hover:dark:text-zinc-200",
          // border color
          "border-zinc-300 dark:border-zinc-700",
          // background color
          "hover:bg-zinc-50 active:bg-zinc-100",
          "hover:dark:bg-zinc-900 active:dark:bg-zinc-800",
          // disabled
          "disabled:pointer-events-none",
          "disabled:border-zinc-200 disabled:dark:border-zinc-800",
          "disabled:text-zinc-400 disabled:dark:text-zinc-600",
          focusRing
        )}
        onClick={onClick}
        {...props}
      >
        <Icon className="size-full shrink-0" />
      </button>
    )
  }
)

NavigationButton.displayName = "NavigationButton"

const Calendar = ({
  mode = "single",
  weekStartsOn = 1,
  numberOfMonths = 1,
  enableYearNavigation = false,
  disableNavigation,
  locale,
  className,
  classNames,
  ...props
}) => {
  return (
    <DayPicker
      mode={mode}
      weekStartsOn={weekStartsOn}
      numberOfMonths={numberOfMonths}
      locale={locale}
      showOutsideDays={numberOfMonths === 1 ? true : false}
      className={cn(className)}
      classNames={{
        months: "flex space-y-0",
        month: "space-y-4 p-3",
        nav:
          "gap-1 flex items-center rounded-full size-full justify-between p-4",
        table: "w-full border-collapse space-y-1",
        head_cell:
          "w-9 font-medium text-sm sm:text-xs text-center text-zinc-400 dark:text-zinc-600 pb-2",
        row: "w-full mt-0.5",
        cell: cn(
          "relative p-0 text-center focus-within:relative",
          "text-zinc-900 dark:text-zinc-50"
        ),
        day: cn(
          "size-9 rounded text-sm text-zinc-900 dark:text-zinc-50",
          "hover:bg-zinc-200 hover:dark:bg-zinc-700",
          focusRing
        ),
        day_today: "font-semibold",
        day_selected: cn(
          "rounded",
          "aria-selected:bg-zinc-900 aria-selected:text-zinc-50",
          "dark:aria-selected:bg-zinc-50 dark:aria-selected:text-zinc-900"
        ),
        day_disabled:
          "!text-zinc-300 dark:!text-zinc-700 line-through disabled:hover:bg-transparent",
        day_outside: "text-zinc-400 dark:text-zinc-600",
        day_range_middle: cn(
          "!rounded-none",
          "aria-selected:!bg-zinc-100 aria-selected:!text-zinc-900",
          "dark:aria-selected:!bg-zinc-900 dark:aria-selected:!text-zinc-50"
        ),
        day_range_start: "rounded-r-none !rounded-l",
        day_range_end: "rounded-l-none !rounded-r",
        day_hidden: "invisible",
        ...classNames
      }}
      components={{
        IconLeft: () => <ArrowLeft className="size-4" />,
        IconRight: () => <ArrowRight className="size-4" />,
        Caption: ({ ...props }) => {
          const {
            goToMonth,
            nextMonth,
            previousMonth,
            currentMonth,
            displayMonths
          } = useNavigation()
          const { numberOfMonths, fromDate, toDate } = useDayPicker()

          const displayIndex = displayMonths.findIndex(month =>
            isSameMonth(props.displayMonth, month)
          )
          const isFirst = displayIndex === 0
          const isLast = displayIndex === displayMonths.length - 1

          const hideNextButton = numberOfMonths > 1 && (isFirst || !isLast)
          const hidePreviousButton = numberOfMonths > 1 && (isLast || !isFirst)

          const goToPreviousYear = () => {
            const targetMonth = addYears(currentMonth, -1)
            if (
              previousMonth &&
              (!fromDate || targetMonth.getTime() >= fromDate.getTime())
            ) {
              goToMonth(targetMonth)
            }
          }

          const goToNextYear = () => {
            const targetMonth = addYears(currentMonth, 1)
            if (
              nextMonth &&
              (!toDate || targetMonth.getTime() <= toDate.getTime())
            ) {
              goToMonth(targetMonth)
            }
          }

          return (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                {enableYearNavigation && !hidePreviousButton && (
                  <NavigationButton
                    disabled={
                      disableNavigation ||
                      !previousMonth ||
                      (fromDate &&
                        addYears(currentMonth, -1).getTime() <
                          fromDate.getTime())
                    }
                    aria-label="Go to previous year"
                    onClick={goToPreviousYear}
                    icon={ArrowLeft}
                  />
                )}
                {!hidePreviousButton && (
                  <NavigationButton
                    disabled={disableNavigation || !previousMonth}
                    aria-label="Go to previous month"
                    onClick={() => previousMonth && goToMonth(previousMonth)}
                    icon={ArrowLeft}
                  />
                )}
              </div>

              <div
                role="presentation"
                aria-live="polite"
                className="text-sm font-medium capitalize tabular-nums text-zinc-900 dark:text-zinc-50"
              >
                {format(props.displayMonth, "LLLL yyy", { locale })}
              </div>

              <div className="flex items-center gap-1">
                {!hideNextButton && (
                  <NavigationButton
                    disabled={disableNavigation || !nextMonth}
                    aria-label="Go to next month"
                    onClick={() => nextMonth && goToMonth(nextMonth)}
                    icon={ArrowRight}
                  />
                )}
                {enableYearNavigation && !hideNextButton && (
                  <NavigationButton
                    disabled={
                      disableNavigation ||
                      !nextMonth ||
                      (toDate &&
                        addYears(currentMonth, 1).getTime() > toDate.getTime())
                    }
                    aria-label="Go to next year"
                    onClick={goToNextYear}
                    icon={ArrowRight}
                  />
                )}
              </div>
            </div>
          )
        },
        Day: ({ date, displayMonth }) => {
          const ref = React.useRef(null)
          const {
            activeModifiers,
            buttonProps,
            divProps,
            isButton,
            isHidden
          } = useDayRender(date, displayMonth, ref)

          const { selected, today, disabled, range_middle } = activeModifiers

          React.useEffect(() => {
            if (selected) {
              ref.current?.focus()
            }
          }, [selected])

          if (isHidden) {
            return <></>
          }

          if (!isButton) {
            return (
              <div
                {...divProps}
                className={cn(
                  "flex items-center justify-center",
                  divProps.className
                )}
              />
            )
          }

          const {
            children: buttonChildren,
            className: buttonClassName,
            ...buttonPropsRest
          } = buttonProps

          return (
            <button
              ref={ref}
              {...buttonPropsRest}
              type="button"
              className={cn("relative", buttonClassName)}
            >
              {buttonChildren}
              {today && (
                <span
                  className={cn(
                    "absolute inset-x-1/2 bottom-1.5 h-0.5 w-4 -translate-x-1/2 rounded-[2px]",
                    {
                      "bg-blue-500 dark:bg-blue-500": !selected,
                      "!bg-white dark:!bg-zinc-950": selected,
                      "!bg-zinc-400 dark:!bg-zinc-600":
                        selected && range_middle,
                      "text-zinc-400 dark:text-zinc-600": disabled
                    }
                  )}
                />
              )}
            </button>
          )
        }
      }}
      {...props}
    />
  )
}

Calendar.displayName = "Calendar"

export { Calendar }
