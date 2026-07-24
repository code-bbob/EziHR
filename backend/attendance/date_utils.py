"""
Nepali Date (Bikram Sambat) and English Date (Gregorian) conversion utilities.

This module provides functions to convert between Nepali (BS) and English (AD) calendar systems.
"""

from datetime import date, datetime, timedelta

# Nepali date range mapping (year, month, day) to Gregorian date
# This data is derived from official nepali calendar conversion tables
NEPALI_MONTH_DAYS = {
    2000: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2001: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2002: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 31],
    2003: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 31],
    2004: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 31],
    2005: [31, 32, 32, 31, 31, 30, 30, 29, 30, 29, 30, 31],
    2006: [31, 32, 32, 31, 31, 30, 30, 29, 30, 29, 30, 31],
    2007: [31, 32, 32, 31, 31, 31, 29, 30, 29, 30, 30, 31],
    2008: [31, 31, 32, 32, 31, 31, 29, 30, 29, 30, 30, 31],
    2009: [31, 31, 32, 32, 31, 30, 30, 29, 29, 30, 30, 31],
    2010: [31, 31, 32, 31, 31, 30, 30, 29, 30, 29, 30, 31],
    2011: [31, 31, 32, 31, 31, 30, 30, 29, 30, 29, 30, 31],
    2012: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 31],
    2013: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 31],
    2014: [31, 32, 31, 32, 31, 31, 29, 30, 29, 30, 30, 31],
    2015: [31, 32, 32, 31, 31, 31, 29, 30, 29, 30, 30, 31],
    2016: [31, 32, 32, 31, 31, 30, 30, 29, 29, 30, 30, 31],
    2017: [31, 31, 32, 32, 31, 30, 30, 29, 29, 30, 30, 31],
    2018: [31, 31, 32, 32, 31, 31, 29, 30, 29, 30, 30, 31],
    2019: [31, 31, 32, 31, 32, 31, 29, 30, 29, 30, 30, 31],
    2020: [31, 32, 31, 32, 31, 30, 30, 29, 29, 30, 30, 31],
    2021: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 31],
    2022: [31, 32, 32, 31, 31, 30, 30, 29, 30, 29, 30, 31],
    2023: [31, 32, 32, 31, 31, 30, 30, 29, 30, 29, 30, 31],
    2024: [31, 32, 32, 31, 31, 31, 29, 30, 29, 30, 30, 31],
    2025: [31, 32, 32, 31, 31, 31, 29, 30, 29, 30, 30, 31],
    2026: [31, 31, 32, 32, 31, 30, 30, 29, 29, 30, 30, 31],
    2027: [31, 31, 32, 32, 31, 31, 29, 30, 29, 30, 30, 31],
    2028: [31, 31, 32, 31, 32, 31, 29, 30, 29, 30, 30, 31],
    2029: [31, 32, 31, 32, 31, 30, 30, 29, 29, 30, 30, 31],
    2030: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 31],
    2031: [31, 32, 32, 31, 31, 30, 30, 29, 30, 29, 30, 31],
    2032: [31, 32, 32, 31, 31, 31, 29, 30, 29, 30, 30, 31],
    2033: [31, 32, 32, 31, 31, 31, 29, 30, 29, 30, 30, 31],
    2034: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    2035: [30, 32, 31, 32, 31, 31, 29, 30, 30, 29, 29, 31],
    2036: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2037: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    2038: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    2039: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
    2040: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2041: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    2042: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    2043: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
    2044: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2045: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    2046: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    2047: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
    2048: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2049: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
    2050: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
    2051: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
    2052: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2053: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
    2054: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
    2055: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2056: [31, 31, 32, 31, 32, 30, 30, 29, 30, 29, 30, 30],
    2057: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    2058: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
    2059: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2060: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    2061: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    2062: [30, 32, 31, 32, 31, 31, 29, 30, 29, 30, 29, 31],
    2063: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2064: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    2065: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    2066: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 29, 31],
    2067: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2068: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    2069: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    2070: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
    2071: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2072: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    2073: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    2074: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
    2075: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2076: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
    2077: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
    2078: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
    2079: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2080: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
    2081: [31, 31, 32, 32, 31, 30, 30, 30, 29, 30, 30, 30],
    2082: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],
    2083: [31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 30, 30],
    2084: [31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 30, 30],
    2085: [31, 32, 31, 32, 30, 31, 30, 30, 29, 30, 30, 30],
    2086: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],
    2087: [31, 31, 32, 31, 31, 31, 30, 30, 29, 30, 30, 30],
    2088: [30, 31, 32, 32, 30, 31, 30, 30, 29, 30, 30, 30],
    2089: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],
    2090: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],
    2091: [31, 31, 32, 31, 31, 31, 30, 30, 29, 30, 30, 30],
    2092: [31, 31, 32, 32, 31, 30, 30, 30, 29, 30, 30, 30],
}

# Reference point: Nepali 2000-01-01 is Gregorian 1943-04-14
NEPALI_EPOCH_AD = date(1943, 4, 14)
NEPALI_EPOCH_BS_YEAR = 2000
NEPALI_EPOCH_BS_MONTH = 1
NEPALI_EPOCH_BS_DAY = 1


from typing import Union, Tuple


# Prefer the external `nepali_date_utils` package for conversion if available.
try:
    from nepali_date_utils import converter as _ndu_converter
    _HAS_NEPALI_CONVERTER = True
except Exception:
    _ndu_converter = None
    _HAS_NEPALI_CONVERTER = False

# Use the package's own month table as the fallback source for years that are
# not explicitly listed below. The installed package currently covers BS 1978
# through 2092.
try:
    from nepali_date_utils.data import calendar_data as _PACKAGE_CALENDAR_DATA
except Exception:
    _PACKAGE_CALENDAR_DATA = {}


def get_nepali_month_days(nepali_year: int, nepali_month: int) -> int:
    """Get number of days in a Nepali month."""
    if nepali_year not in NEPALI_MONTH_DAYS:
        if nepali_year in _PACKAGE_CALENDAR_DATA:
            return _PACKAGE_CALENDAR_DATA[nepali_year][nepali_month - 1]
        raise ValueError(f"Nepali year out of supported range: {nepali_year}")
    return NEPALI_MONTH_DAYS[nepali_year][nepali_month - 1]


def ad_to_bs(gregorian_date: Union[date, datetime]) -> Tuple[int, int, int]:
    """
    Convert Gregorian (AD) date to Nepali (BS) date.
    
    Args:
        gregorian_date: A datetime.date or datetime.datetime object
        
    Returns:
        A tuple of (nepali_year, nepali_month, nepali_day)
        
    Example:
        >>> ad_to_bs(date(2023, 5, 15))
        (2080, 2, 1)
    """
    # Try external converter first (more up-to-date/accurate)
    if _HAS_NEPALI_CONVERTER:
        try:
            if isinstance(gregorian_date, datetime):
                gregorian_date = gregorian_date.date()
            s = gregorian_date.strftime('%Y/%m/%d')
            res = _ndu_converter.ad_to_bs(s)
            # Normalise separators and parse
            res = str(res).replace('-', '/')
            y, m, d = res.split('/')
            return int(y), int(m), int(d)
        except Exception:
            # Fall back to internal implementation on any error
            pass

    if isinstance(gregorian_date, datetime):
        gregorian_date = gregorian_date.date()

    # Calculate days from epoch (internal fallback)
    delta_days = (gregorian_date - NEPALI_EPOCH_AD).days

    # Start from epoch
    nepali_year = NEPALI_EPOCH_BS_YEAR
    nepali_month = NEPALI_EPOCH_BS_MONTH
    nepali_day = NEPALI_EPOCH_BS_DAY

    # Add the days
    days_to_add = delta_days

    while days_to_add > 0:
        # Get days in current month
        days_in_month = get_nepali_month_days(nepali_year, nepali_month)
        days_left_in_month = days_in_month - nepali_day + 1

        if days_to_add >= days_left_in_month:
            # Move to next month
            days_to_add -= days_left_in_month
            nepali_day = 1
            nepali_month += 1

            if nepali_month > 12:
                nepali_month = 1
                nepali_year += 1
        else:
            # Add days to current month
            nepali_day += days_to_add
            days_to_add = 0

    return nepali_year, nepali_month, nepali_day


def bs_to_ad(nepali_year: int, nepali_month: int, nepali_day: int) -> date:
    """
    Convert Nepali (BS) date to Gregorian (AD) date.
    
    Args:
        nepali_year: Nepali year
        nepali_month: Nepali month (1-12)
        nepali_day: Nepali day (1-31)
        
    Returns:
        A datetime.date object
        
    Example:
        >>> bs_to_ad(2080, 2, 1)
        datetime.date(2023, 5, 15)
    """
    # Try external converter first
    if _HAS_NEPALI_CONVERTER:
        try:
            s = f"{int(nepali_year)}/{int(nepali_month)}/{int(nepali_day)}"
            res = _ndu_converter.bs_to_ad(s)
            res = str(res).replace('-', '/')
            # Expect YYYY/MM/DD
            return datetime.strptime(res, '%Y/%m/%d').date()
        except Exception:
            # Fall back to internal implementation on any error
            pass

    # Internal fallback calculation
    days = 0

    # Add days for complete years
    for year in range(NEPALI_EPOCH_BS_YEAR, nepali_year):
        for month in range(1, 13):
            days += get_nepali_month_days(year, month)

    # Add days for complete months in current year
    for month in range(1, nepali_month):
        days += get_nepali_month_days(nepali_year, month)

    # Add days in current month
    days += nepali_day - 1

    # Calculate Gregorian date
    gregorian_date = NEPALI_EPOCH_AD + timedelta(days=days)
    return gregorian_date


def format_ad_date(gregorian_date: Union[date, datetime], format_str: str = "%Y-%m-%d") -> str:
    """
    Format an Gregorian date as string.
    
    Args:
        gregorian_date: A datetime.date or datetime.datetime object
        format_str: Format string (default: YYYY-MM-DD)
        
    Returns:
        Formatted date string
    """
    if isinstance(gregorian_date, datetime):
        gregorian_date = gregorian_date.date()
    return gregorian_date.strftime(format_str)


def format_bs_date(nepali_year: int, nepali_month: int, nepali_day: int, 
                   format_str: str = "{year}-{month:02d}-{day:02d}") -> str:
    """
    Format a Nepali date as string.
    
    Args:
        nepali_year: Nepali year
        nepali_month: Nepali month
        nepali_day: Nepali day
        format_str: Format string with {year}, {month}, {day} placeholders
        
    Returns:
        Formatted date string
    """
    return format_str.format(year=nepali_year, month=nepali_month, day=nepali_day)


def parse_nepali_date_string(date_str: str, format_str: str = "{year}-{month:02d}-{day:02d}") -> Tuple[int, int, int]:
    """
    Parse a Nepali date string.
    
    Args:
        date_str: Date string (e.g., "2080-02-01")
        format_str: Expected format
        
    Returns:
        A tuple of (nepali_year, nepali_month, nepali_day)
    """
    # Simple parsing for standard format YYYY-MM-DD
    parts = date_str.split('-')
    if len(parts) == 3:
        try:
            return int(parts[0]), int(parts[1]), int(parts[2])
        except ValueError:
            raise ValueError(f"Invalid Nepali date string: {date_str}")
    raise ValueError(f"Invalid Nepali date string format: {date_str}")
