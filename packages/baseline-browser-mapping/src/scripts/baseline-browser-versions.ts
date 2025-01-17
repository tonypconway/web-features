import bcdBrowsers from "@mdn/browser-compat-data" assert { type: "json" };
import otherBrowsers from "../data/downstream-browsers.json" assert { type: "json" };

const bcdCoreBrowserNames: string[] = [
  "chrome",
  "chrome_android",
  "edge",
  "firefox",
  "firefox_android",
  "safari",
  "safari_ios",
];

const coreBrowserData = Object.entries(bcdBrowsers.browsers).filter(
  ([browserName, browserData]) => bcdCoreBrowserNames.includes(browserName),
);

const bcdDownstreamBrowserNames: string[] = [
  "webview_android",
  "samsunginternet_android",
  "opera_android",
  "opera",
];

const downstreamBrowserData = [
  ...Object.entries(bcdBrowsers.browsers).filter(([browserName, browserData]) =>
    bcdDownstreamBrowserNames.includes(browserName),
  ),
  ...Object.entries(otherBrowsers.browsers),
];

const acceptableStatuses: string[] = ["current", "esr", "retired", "unknown"];

interface BrowserVersion {
  browser: string;
  version: string;
  release_date: string;
  engine: string | null;
  engine_version: string | null;
}

const compareVersions = (
  incomingVersionString: string,
  previousVersionString: string,
): number => {
  let [incomingVersionStringMajor, incomingVersionStringMinor] =
    incomingVersionString.split(".");
  let [previousVersionStringMajor, previousVersionStringMinor] =
    previousVersionString.split(".");

  if (!incomingVersionStringMajor || !previousVersionStringMajor) {
    throw new Error(
      "One of these version strings is broken: " +
        incomingVersionString +
        " or " +
        previousVersionString +
        "",
    );
  }

  if (incomingVersionStringMinor) {
    if (
      parseInt(incomingVersionStringMajor) >=
        parseInt(previousVersionStringMajor) &&
      (!previousVersionStringMinor ||
        parseInt(incomingVersionStringMinor) >
          parseInt(previousVersionStringMinor))
    ) {
      return 1;
    }
  } else {
    if (incomingVersionStringMajor > previousVersionStringMajor) {
      return 1;
    }
  }
  return 0;
};

const getCoreVersionsByDate = (
  date: Date,
  minOnly: boolean = true,
): BrowserVersion[] => {
  if (date.getFullYear() < 2015) {
    throw new Error(
      "There are no browser versions compatible with Baseline before 2015",
    );
  }

  if (date.getFullYear() >= new Date().getFullYear()) {
    throw new Error(
      "There are no browser versions compatible with Baseline in the future",
    );
  }

  let versions: BrowserVersion[] = new Array();

  coreBrowserData.forEach(([browserName, browserData]) => {
    let sortedVersions = Object.entries(browserData.releases)
      .filter(([versionNumber, versionData]) => {
        if (!acceptableStatuses.includes(versionData.status)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        {
          return compareVersions(a[0], b[0]);
        }
      });
    for (let i = 1; i < sortedVersions.length; i++) {
      const thisVersion = sortedVersions[i];
      if (thisVersion) {
        const versionData = thisVersion[1];
        const prevVersion = sortedVersions[i - 1];
        if (prevVersion) {
          const [prevVersionNumber, prevVersionData] = prevVersion;
          if (
            versionData.release_date &&
            new Date(versionData.release_date) > date
          ) {
            versions.push({
              browser: browserName,
              version: prevVersionNumber,
              release_date: prevVersionData.release_date
                ? prevVersionData.release_date
                : "unknown",
              engine: null,
              engine_version: null,
            });
            if (minOnly) {
              break;
            }
          }
        }
      }
    }
  });

  return versions;
};

const getDownstreamBrowsers = (
  inputArray: BrowserVersion[] = [],
  minOnly: boolean = true,
): BrowserVersion[] => {
  let minimumChromeVersion: string | undefined = undefined;
  if (inputArray && inputArray.length > 0) {
    minimumChromeVersion = inputArray
      .filter((browser: BrowserVersion) => browser.browser === "chrome")
      .sort((a: BrowserVersion, b: BrowserVersion) => {
        return compareVersions(a.version, b.version);
      })[0]?.version;
  }

  if (!minimumChromeVersion) {
    throw new Error(
      "There are no browser versions compatible with Baseline before Chrome",
    );
  }

  let downstreamArray: BrowserVersion[] = new Array();

  downstreamBrowserData.forEach(([browserName, browserData]) => {
    let sortedAndFilteredVersions = Object.entries(browserData.releases)
      .filter(([versionNumber, versionData]) => {
        if (!versionData.engine) {
          return false;
        }
        if (versionData.engine != "Blink") {
          return false;
        }
        if (
          parseInt(versionData.engine_version) < parseInt(minimumChromeVersion)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        return compareVersions(a[0], b[0]);
      });

    for (let i = 0; i < sortedAndFilteredVersions.length; i++) {
      const versionEntry = sortedAndFilteredVersions[i];
      if (versionEntry) {
        const [versionNumber, versionData] = versionEntry;
        downstreamArray.push({
          browser: browserName,
          version: versionNumber,
          release_date: versionData.release_date,
          engine: versionData.engine,
          engine_version: versionData.engine_version,
        });
        if (minOnly) {
          break;
        }
      }
    }
  });
  let outputArray = [...inputArray, ...downstreamArray];
  return outputArray;
};

export function getMinimumWidelyAvailable(
  includeDownstream: boolean = false,
): BrowserVersion[] {
  const date30MonthsAgo = new Date();
  date30MonthsAgo.setMonth(new Date().getMonth() - 30);
  let coreBrowserArray = getCoreVersionsByDate(date30MonthsAgo);
  if (!includeDownstream) {
    return coreBrowserArray;
  } else {
    return getDownstreamBrowsers(coreBrowserArray);
  }
}

export function getAllWidelyAvailable(
  includeDownstream: boolean = false,
): BrowserVersion[] {
  let date30MonthsAgo = new Date();
  date30MonthsAgo.setMonth(new Date().getMonth() - 30);
  let coreBrowserArray = getCoreVersionsByDate(date30MonthsAgo, false);
  if (!includeDownstream) {
    return coreBrowserArray;
  } else {
    return getDownstreamBrowsers(coreBrowserArray, false);
  }
}
export function getMinimumWidelyAvailableOnDate(
  dateString: string,
  includeDownstream: boolean = false,
): BrowserVersion[] {
  const givenDate = new Date(Date.parse(dateString));
  const givenDateLess30Months = new Date(
    givenDate.setMonth(givenDate.getMonth() - 30),
  );
  let coreBrowserArray = getCoreVersionsByDate(givenDateLess30Months);
  if (!includeDownstream) {
    return coreBrowserArray;
  } else {
    return getDownstreamBrowsers(coreBrowserArray);
  }
}
export function getAllWidelyAvailableOnDate(
  dateString: string,
  includeDownstream: boolean = false,
): BrowserVersion[] {
  const givenDate = new Date(Date.parse(dateString));
  const givenDateLess30Months = new Date(
    givenDate.setMonth(givenDate.getMonth() - 30),
  );
  let coreBrowserArray = getCoreVersionsByDate(givenDateLess30Months, false);
  if (!includeDownstream) {
    return coreBrowserArray;
  } else {
    return getDownstreamBrowsers(coreBrowserArray, false);
  }
}
export function getMinimumByYear(
  year: string,
  includeDownstream: boolean = false,
): BrowserVersion[] {
  const date = new Date(parseInt(year) + 1, 0, 1);
  let coreBrowserArray = getCoreVersionsByDate(date);
  if (!includeDownstream) {
    return coreBrowserArray;
  } else {
    return getDownstreamBrowsers(coreBrowserArray);
  }
}
export function getAllByYear(
  year: string,
  includeDownstream: boolean = false,
): BrowserVersion[] {
  const date = new Date(parseInt(year) + 1, 0, 1);
  let coreBrowserArray = getCoreVersionsByDate(date, false);
  if (!includeDownstream) {
    return coreBrowserArray;
  } else {
    return getDownstreamBrowsers(coreBrowserArray, false);
  }
}
