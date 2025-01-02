import React, { useEffect } from "react";
import { MenuItem, Select } from "@mui/material";

interface SelectMonthProps {
    currentYear: number | null;
    currentMonth: number | null;
    startPossibleDate: Date;
    endPossibleDate: Date;
    onMonthChanged: (year: number, month: number) => void;
}

export function getAvailableYears() {
    const years = new Set<number>();
    const currentYear = new Date().getUTCFullYear();
    for (let i = 2023; i <= currentYear; i++) {
        years.add(i);
    }
    return Array.from(years);
}

export function getSelectedYearMonth() {
    try {
        const selectedYear = parseInt(localStorage.getItem("selectedYear") ?? "");
        const selectedMonth = parseInt(localStorage.getItem("selectedMonth") ?? "");
        if (selectedYear && selectedMonth) {
            return { selectedYear: selectedYear, selectedMonth: selectedMonth };
        }
    } catch (_ex) {
        //ignore
    }
    //current date
    const nd = new Date();
    return {
        selectedYear: nd.getUTCFullYear(),
        selectedMonth: nd.getUTCMonth() + 1,
    };
}

export function getFirstDayInMonth(year: number, month: number) {
    return new Date(Date.UTC(year, month - 1, 1));
}
export function getLastDayInMonth(year: number, month: number) {
    const firstDay = getFirstDayInMonth(year, month);
    return new Date(firstDay.setUTCMonth(firstDay.getUTCMonth() + 1));
}

export const shortMonth = (yearMonth: string) => {
    const month = parseInt(yearMonth.split("-")[1]);
    const months = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months[month];
};

function listMonthsInRange(startDate: Date, endDate: Date) {
    const result = [];
    const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1); // Set to the first day of the start month

    // Loop through each month until we reach or pass the end month
    while (current <= endDate) {
        const year = current.getFullYear();
        const month = current.getMonth() + 1; // getMonth() is 0-based, so add 1 for display purposes
        result.push({ year: year, month: month });

        // Move to the next month
        current.setMonth(current.getMonth() + 1);
    }

    return result;
}

const SelectMonth = (props: SelectMonthProps) => {
    const allMonths = [
        "",
        "01 - Jan",
        "02 - Feb",
        "03 - Mar",
        "04 - Apr",
        "05 - May",
        "06 - Jun",
        "07 - Jul",
        "08 - Aug",
        "09 - Sep",
        "10 - Oct",
        "11 - Nov",
        "12 - Dec",
    ];
    const includedMonths = new Set<number>();
    const includedYears = new Set<number>();
    //iterate over all months and years
    for (const range of listMonthsInRange(props.startPossibleDate, props.endPossibleDate)) {
        includedYears.add(range.year);
        if (range.year === props.currentYear) {
            includedMonths.add(range.month);
        }
    }

    useEffect(() => {
        if (!includedYears.has(props.currentYear ?? -1) || !includedMonths.has(props.currentMonth ?? -1)) {
            const year = Array.from(includedYears);
            const month = Array.from(includedMonths);
            if (year.length > 0 && month.length > 0) {
                props.onMonthChanged(Array.from(includedYears)[0], Array.from(includedMonths)[0]);
            }
        }
    }, [props.currentMonth, props.currentYear, props.startPossibleDate, props.endPossibleDate]);

    if (props.currentYear == null || props.currentMonth == null || props.currentMonth == 0) {
        return <div>Invalid date</div>;
    }
    const sortedIncludedMonths = Array.from(includedMonths).sort((a, b) => a - b);
    const sortedIncludedYears = Array.from(includedYears).sort((a, b) => a - b);
    return (
        <div>
            <Select
                sx={{ marginRight: 1 }}
                value={props.currentYear}
                onChange={(e) => props.onMonthChanged(parseInt(e.target.value.toString()), props.currentMonth ?? -1)}
            >
                {Array.from(sortedIncludedYears).map((year) => {
                    return (
                        <MenuItem key={year} value={year}>
                            {year}
                        </MenuItem>
                    );
                })}
            </Select>
            <Select
                sx={{ width: 120 }}
                value={props.currentMonth}
                onChange={(e) => props.onMonthChanged(props.currentYear ?? -1, parseInt(e.target.value.toString()))}
            >
                {sortedIncludedMonths.map((month) => {
                    return (
                        <MenuItem key={month} value={month}>
                            {allMonths[month]}
                        </MenuItem>
                    );
                })}
            </Select>
        </div>
    );
};

export default SelectMonth;
