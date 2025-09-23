using System.Data;
using System.Data.Common;
using System.Globalization;
using System.Linq;
using System.Text.Json;

public static class DbCommandJsonParameterHelper
{
    public static void AddParametersFromJson(DbCommand cmd, IDictionary<string, string?> parameters)
    {
        if (cmd == null) throw new ArgumentNullException(nameof(cmd));
        if (parameters == null) return;

        foreach (var kvp in parameters)
        {
            var name = NormalizeName(kvp.Key);
            var raw = kvp.Value;

            // treat explicit "null" (string) as null
            if (string.IsNullOrWhiteSpace(raw) || string.Equals(raw.Trim(), "null", StringComparison.OrdinalIgnoreCase))
            {
                var p = cmd.CreateParameter();
                p.ParameterName = name;
                p.Value = DBNull.Value;
                p.DbType = DbType.String; 
                cmd.Parameters.Add(p);
                continue;
            }

            var trimmed = raw!.Trim();

            // JSON array string? try parse it as JSON array and expand elements
            if (IsJsonArray(trimmed))
            {
                try
                {
                    using var doc = JsonDocument.Parse(trimmed);
                    var arr = doc.RootElement.EnumerateArray().ToArray();
                    for (int i = 0; i < arr.Length; i++)
                    {
                        var elem = ConvertJsonElementToClr(arr[i]);
                        CreateAndAdd(cmd, $"{name}_{i}", elem);
                    }
                    continue;
                }
                catch
                {
                }
            }

            // simple CSV (not JSON) — expand to param_0,param_1,...
            if (trimmed.Contains(',') && !trimmed.Contains('\"') && !trimmed.StartsWith("0x", StringComparison.OrdinalIgnoreCase))
            {
                var parts = trimmed.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                for (int i = 0; i < parts.Length; i++)
                {
                    var elem = ConvertStringToClr(parts[i]);
                    CreateAndAdd(cmd, $"{name}_{i}", elem);
                }
                continue;
            }

            // not array => single value
            var value = ConvertStringToClr(trimmed);
            CreateAndAdd(cmd, name, value);
        }
    }

    private static string NormalizeName(string name)
        => string.IsNullOrWhiteSpace(name) ? throw new ArgumentException("Parameter name") : (name.StartsWith("@") ? name : "@" + name);

    private static void CreateAndAdd(DbCommand cmd, string paramName, object? value)
    {
        var p = cmd.CreateParameter();
        p.ParameterName = paramName;
        if (value == null) p.Value = DBNull.Value;
        else p.Value = value;
        SetDbTypeForParameter(p, value?.GetType());
        cmd.Parameters.Add(p);
    }

    private static object? ConvertJsonElementToClr(JsonElement el)
    {
        return el.ValueKind switch
        {
            JsonValueKind.Null => null,
            JsonValueKind.String => ConvertStringToClr(el.GetString()!),
            JsonValueKind.Number =>
                el.TryGetInt64(out var l) ? (object)l :
                el.TryGetDecimal(out var d) ? (object)d :
                el.TryGetDouble(out var dd) ? (object)dd : (object)el.GetRawText(),
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.Array => el.EnumerateArray().Select(ConvertJsonElementToClr).ToArray(),
            JsonValueKind.Object => el.GetRawText(), 
            _ => el.GetRawText()
        };
    }

    private static object? ConvertStringToClr(string s)
    {
        if (string.IsNullOrEmpty(s)) return string.Empty;
        var t = s.Trim();
        if (string.IsNullOrEmpty(t)) return string.Empty;

        if (string.Equals(t, "null", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(t, "NULL", StringComparison.Ordinal) ||
            string.Equals(t, "nil", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(t, "undefined", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        if (t.Length == 0) return string.Empty;

        try
        {
            // 1. Handle quoted strings first - explicit intent to keep as string
            if (IsQuotedString(t, out var unquoted)) return unquoted;

            // 2. GUID - very specific format, commonly used in databases, no conflicts
            if (TryParseGuid(t, out var guid)) return guid;

            // 5. Numbers - MOST COMMON in database parameters, prioritize integers
            if (TryParseNumeric(t, out var numeric)) return numeric;

            // 7. DateTime/DateTimeOffset - common but can conflict with numbers, check after numeric
            if (TryParseDateTimeOffset(t, out var dto)) return dto;
            if (TryParseDateTime(t, out var dt)) return dt;

            // 8. TimeSpan - less common, check after date/time
            if (TryParseTimeSpan(t, out var ts)) return ts;

            // 3. Obvious boolean values - common in databases, avoid "1"/"0" conflicts
            if (TryParseObviousBoolean(t, out var b)) return b;

            // 4. Hex bytes with prefixes - specific format, should be caught early
            if (TryParseHexBytes(t, out var hexBytes)) return hexBytes;

            // 6. Remaining boolean values (like "1", "0") - after numeric to avoid conflicts
            if (TryParseBoolean(t, out var boolVal)) return boolVal;

            // 9. Email addresses - keep as string, check before URI to avoid conflicts
            if (IsEmailAddress(t)) return t;

            // 10. URLs/URIs - less common, can conflict with other formats
            if (TryParseUri(t, out var uri)) return uri;

            // 11. Base64 - least common, most likely to have false positives
            if (TryParseBase64(t, out var b64)) return b64;

            // 12. Fallback: keep as string (most database columns are strings anyway)
            return t;
        }
        catch (Exception)
        {
            return t;
        }
    }
    private static bool TryParseGuid(string input, out Guid guid)
    {
        guid = default;

        if (Guid.TryParse(input, out guid)) return true;

        if (input.Length == 32 && input.All(c => char.IsDigit(c) || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')))
        {
            try
            {
                var formatted = $"{input.Substring(0, 8)}-{input.Substring(8, 4)}-{input.Substring(12, 4)}-{input.Substring(16, 4)}-{input.Substring(20, 12)}";
                return Guid.TryParse(formatted, out guid);
            }
            catch { }
        }

        return false;
    }

    private static bool TryParseDateTimeOffset(string input, out DateTimeOffset dto)
    {
        dto = default;

        if (DateTimeOffset.TryParse(input, CultureInfo.InvariantCulture,
            DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out dto))
            return true;

        if (DateTimeOffset.TryParse(input, out dto)) return true;

        var isoFormats = new[]
        {
        "yyyy-MM-ddTHH:mm:ssZ",
        "yyyy-MM-ddTHH:mm:ss.fffZ",
        "yyyy-MM-ddTHH:mm:ss.fffffffZ",
        "yyyy-MM-dd HH:mm:ss",
        "yyyy/MM/dd HH:mm:ss",
        "MM/dd/yyyy HH:mm:ss",
        "dd/MM/yyyy HH:mm:ss"
    };

        foreach (var format in isoFormats)
        {
            if (DateTimeOffset.TryParseExact(input, format, CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeUniversal, out dto))
                return true;
        }

        return false;
    }

    private static bool TryParseDateTime(string input, out DateTime dt)
    {
        dt = default;

        if (DateTime.TryParse(input, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out dt))
            return true;

        if (DateTime.TryParse(input, out dt)) return true;

        if (TryParseUnixTimestamp(input, out dt)) return true;

        var dateFormats = new[]
        {
        "yyyy-MM-dd",
        "yyyy/MM/dd",
        "MM/dd/yyyy",
        "dd/MM/yyyy",
        "MM-dd-yyyy",
        "dd-MM-yyyy",
        "yyyyMMdd"
    };

        foreach (var format in dateFormats)
        {
            if (DateTime.TryParseExact(input, format, CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeLocal, out dt))
                return true;
        }

        return false;
    }

    private static bool TryParseUnixTimestamp(string input, out DateTime dt)
    {
        dt = default;

        if (long.TryParse(input, out var unixTime))
        {
            try
            {
                if (unixTime > 1_000_000_000_000) 
                {
                    dt = DateTimeOffset.FromUnixTimeMilliseconds(unixTime).DateTime;
                }
                else
                {
                    dt = DateTimeOffset.FromUnixTimeSeconds(unixTime).DateTime;
                }
                return true;
            }
            catch { }
        }

        return false;
    }

    private static bool TryParseTimeSpan(string input, out TimeSpan ts)
    {
        ts = default;

        if (TimeSpan.TryParse(input, CultureInfo.InvariantCulture, out ts)) return true;
        if (TimeSpan.TryParse(input, out ts)) return true;

        if (double.TryParse(input, NumberStyles.Float, CultureInfo.InvariantCulture, out var value))
        {
            if (value >= 0 && value <= 86400)
            {
                ts = TimeSpan.FromSeconds(value);
                return true;
            }
        }

        if (TryParseTimeSpanShorthand(input, out ts)) return true;

        return false;
    }

    private static bool TryParseTimeSpanShorthand(string input, out TimeSpan ts)
    {
        ts = default;

        if (input.Length < 2) return false;

        var unit = input[^1];
        var numberPart = input[..^1];

        if (double.TryParse(numberPart, NumberStyles.Float, CultureInfo.InvariantCulture, out var value))
        {
            ts = unit switch
            {
                's' or 'S' => TimeSpan.FromSeconds(value),
                'm' or 'M' => TimeSpan.FromMinutes(value),
                'h' or 'H' => TimeSpan.FromHours(value),
                'd' or 'D' => TimeSpan.FromDays(value),
                _ => default
            };
            return unit is 's' or 'S' or 'm' or 'M' or 'h' or 'H' or 'd' or 'D';
        }

        return false;
    }

    private static bool TryParseObviousBoolean(string s, out bool value)
    {
        value = false;

        var lower = s.ToLowerInvariant();

        if (lower is "true" or "false" or "yes" or "no" or "on" or "off" or
            "enabled" or "disabled" or "active" or "inactive")
        {
            value = lower is "true" or "yes" or "on" or "enabled" or "active";
            return true;
        }

        if (lower is "y" or "n" or "t" or "f")
        {
            value = lower is "y" or "t";
            return true;
        }

        return false;
    }

    private static bool TryParseBoolean(string s, out bool value)
    {
        value = false;

        if (bool.TryParse(s, out value)) return true;

        if (s == "1") { value = true; return true; }
        if (s == "0") { value = false; return true; }

        var lower = s.ToLowerInvariant();
        if (lower is "yes" or "y" or "on" or "enabled" or "active" or "t")
        {
            value = true;
            return true;
        }
        if (lower is "no" or "n" or "off" or "disabled" or "inactive" or "f")
        {
            value = false;
            return true;
        }

        return false;
    }

    private static bool TryParseHexBytes(string input, out byte[] bytes)
    {
        bytes = Array.Empty<byte>();

        var hex = input;

        if (hex.StartsWith("0x", StringComparison.OrdinalIgnoreCase))
            hex = hex.Substring(2);
        else if (hex.StartsWith("#"))
            hex = hex.Substring(1);
        else if (!IsHexString(hex))
            return false;

        return TryParseHex(hex, out bytes);
    }

    private static bool IsHexString(string input)
    {
        return !string.IsNullOrEmpty(input) &&
               input.Length % 2 == 0 &&
               input.All(c => char.IsDigit(c) || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F'));
    }

    private static bool TryParseBase64(string input, out byte[] bytes)
    {
        bytes = Array.Empty<byte>();

        // Enhanced base64 detection
        if (!IsLikelyBase64Enhanced(input)) return false;

        try
        {
            bytes = Convert.FromBase64String(input);
            // Additional validation: if it's too short, it might not be intended as base64
            return bytes.Length > 0;
        }
        catch
        {
            return false;
        }
    }

    private static bool IsLikelyBase64Enhanced(string s)
    {
        if (string.IsNullOrEmpty(s) || s.Length < 4 || s.Length % 4 != 0)
            return false;

        // Check for valid base64 characters
        var validChars = s.All(c => char.IsLetterOrDigit(c) || c == '+' || c == '/' || c == '=');
        if (!validChars) return false;

        // Check padding rules
        var paddingIndex = s.IndexOf('=');
        if (paddingIndex != -1)
        {
            // All characters after first '=' should also be '='
            if (!s.Substring(paddingIndex).All(c => c == '=')) return false;
            // At most 2 padding characters
            if (s.Length - paddingIndex > 2) return false;
        }

        // If it looks like a regular word, it's probably not base64
        if (s.Length <= 8 && s.All(char.IsLetter) && !s.Contains('='))
            return false;

        return true;
    }

    private static bool TryParseUri(string input, out Uri uri)
    {
        uri = null!;

        // More strict validation - must look like a URI
        if (string.IsNullOrWhiteSpace(input) || input.Length < 3)
            return false;

        // Must contain a scheme separator or look like a domain
        if (!input.Contains("://") && !input.Contains('.'))
            return false;

        // If it contains spaces, it's probably not a URI
        if (input.Contains(' '))
            return false;

        // Try parsing as absolute URI first
        if (Uri.TryCreate(input, UriKind.Absolute, out uri))
        {
            // Only return URI if it has a valid scheme (http, https, ftp, etc.)
            // and the scheme is more than 1 character (to avoid single letters being schemes)
            if (uri.Scheme.Length > 1 &&
                (uri.Scheme.Equals("http", StringComparison.OrdinalIgnoreCase) ||
                 uri.Scheme.Equals("https", StringComparison.OrdinalIgnoreCase) ||
                 uri.Scheme.Equals("ftp", StringComparison.OrdinalIgnoreCase) ||
                 uri.Scheme.Equals("ftps", StringComparison.OrdinalIgnoreCase) ||
                 uri.Scheme.Equals("file", StringComparison.OrdinalIgnoreCase) ||
                 uri.Scheme.Equals("mailto", StringComparison.OrdinalIgnoreCase) ||
                 uri.Scheme.Equals("tel", StringComparison.OrdinalIgnoreCase)))
            {
                return true;
            }
        }

        // Try adding https:// for domain-like strings
        if (input.Contains('.') && !input.Contains("://"))
        {
            // Must look like a domain: at least one dot, reasonable length, no spaces
            var parts = input.Split('.');
            if (parts.Length >= 2 &&
                parts.All(p => p.Length > 0 && p.All(c => char.IsLetterOrDigit(c) || c == '-')) &&
                parts[^1].Length >= 2) // TLD should be at least 2 characters
            {
                if (Uri.TryCreate("https://" + input, UriKind.Absolute, out uri))
                    return true;
            }
        }

        uri = null!;
        return false;
    }

    private static bool IsEmailAddress(string input)
    {
        // Simple email validation - just check for basic format
        if (string.IsNullOrEmpty(input) || input.Length > 254) return false;

        var atIndex = input.IndexOf('@');
        if (atIndex <= 0 || atIndex == input.Length - 1) return false;

        var dotIndex = input.LastIndexOf('.');
        return dotIndex > atIndex && dotIndex < input.Length - 1;
    }

    private static bool TryParseNumeric(string input, out object numeric)
    {
        numeric = null!;

        // For database parameters, prioritize the most common types:

        // 1. Integer (32-bit) - most common numeric type in databases
        if (int.TryParse(input, NumberStyles.Integer, CultureInfo.InvariantCulture, out var intVal))
        {
            numeric = intVal;
            return true;
        }

        // 2. Decimal - very common for money/precision values
        if (decimal.TryParse(input, NumberStyles.Number, CultureInfo.InvariantCulture, out var decVal))
        {
            numeric = decVal;
            return true;
        }

        // 3. Long (64-bit) - for larger integers
        if (long.TryParse(input, NumberStyles.Integer, CultureInfo.InvariantCulture, out var longVal))
        {
            numeric = longVal;
            return true;
        }

        // 4. Double - for floating point (less precise than decimal but more range)
        if (double.TryParse(input, NumberStyles.Float | NumberStyles.AllowThousands,
            CultureInfo.InvariantCulture, out var doubleVal))
        {
            // Check for special values
            if (double.IsInfinity(doubleVal) || double.IsNaN(doubleVal))
            {
                numeric = doubleVal;
                return true;
            }

            // Only return double if it's a reasonable floating point number
            if (Math.Abs(doubleVal) < 1e15) // Avoid precision issues with very large numbers
            {
                numeric = doubleVal;
                return true;
            }
        }

        // 5. Unsigned types - less common in databases but handle if needed
        if (ulong.TryParse(input, NumberStyles.Integer, CultureInfo.InvariantCulture, out var ulongVal))
        {
            numeric = ulongVal;
            return true;
        }

        return false;
    }

    private static bool IsQuotedString(string input, out string unquoted)
    {
        unquoted = input;

        if (input.Length >= 2)
        {
            var first = input[0];
            var last = input[^1];

            if ((first == '"' && last == '"') || (first == '\'' && last == '\''))
            {
                unquoted = input[1..^1];
                return true;
            }
        }

        return false;
    }

    private static bool TryParseHex(string hex, out byte[] bytes)
    {
        bytes = Array.Empty<byte>();
        try
        {
            if (string.IsNullOrEmpty(hex) || hex.Length % 2 != 0) return false;
            var len = hex.Length / 2;
            var buf = new byte[len];
            for (int i = 0; i < len; i++)
                buf[i] = Convert.ToByte(hex.Substring(i * 2, 2), 16);
            bytes = buf;
            return true;
        }
        catch { return false; }
    }

    private static bool IsJsonArray(string s)
        => s.Length >= 2 && s[0] == '[' && s[^1] == ']';

    private static void SetDbTypeForParameter(DbParameter p, Type? clrType)
    {
        if (clrType == null) { p.DbType = DbType.String; return; }
        var nonNull = Nullable.GetUnderlyingType(clrType) ?? clrType;

        if (nonNull == typeof(Guid)) p.DbType = DbType.Guid;
        else if (nonNull == typeof(int)) p.DbType = DbType.Int32;
        else if (nonNull == typeof(long)) p.DbType = DbType.Int64;
        else if (nonNull == typeof(short)) p.DbType = DbType.Int16;
        else if (nonNull == typeof(byte)) p.DbType = DbType.Byte;
        else if (nonNull == typeof(bool)) p.DbType = DbType.Boolean;
        else if (nonNull == typeof(DateTime)) p.DbType = DbType.DateTime;
        else if (nonNull == typeof(DateTimeOffset)) p.DbType = DbType.DateTimeOffset;
        else if (nonNull == typeof(TimeSpan)) p.DbType = DbType.Time;
        else if (nonNull == typeof(decimal)) p.DbType = DbType.Decimal;
        else if (nonNull == typeof(double)) p.DbType = DbType.Double;
        else if (nonNull == typeof(float)) p.DbType = DbType.Single;
        else if (nonNull == typeof(byte[])) p.DbType = DbType.Binary;
        else p.DbType = DbType.String;
    }
}
