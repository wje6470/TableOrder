export const cardClass =
  "rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:shadow-none";

export const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 transition focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:ring-orange-500/20";

export const pillInputClass =
  "w-full rounded-full border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-gray-900 placeholder-gray-400 transition focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:bg-gray-900";

export const primaryButtonClass =
  "rounded-xl bg-orange-500 px-6 py-3 font-semibold text-white shadow-lg shadow-orange-200 transition duration-200 hover:-translate-y-0.5 hover:bg-orange-600 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none dark:shadow-none";

export const secondaryButtonClass =
  "rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700/50";

export const mutedTextClass = "text-gray-500 dark:text-gray-400";

export const headingClass = "font-bold tracking-tight text-gray-900 dark:text-gray-100";

export function categoryPillClass(isActive: boolean): string {
  return `flex items-center whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
    isActive
      ? "bg-orange-500 text-white shadow-md shadow-orange-200 dark:shadow-none"
      : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
  }`;
}
