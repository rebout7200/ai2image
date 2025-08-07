import type { UserAction, UserSummaryData, CombinedData } from '../types';

export interface CsvRow {
    topic_title: string;
    categories: string;
    is_pm: string;
    post_raw: string;
    post_cooked: string;
    like_count: string;
    reply_count: string;
    url: string;
    created_at: string;
    [key: string]: string; // Allow other columns
}

/**
 * Parses a CSV string into an array of objects.
 * Handles quoted fields containing commas.
 * @param csvText The raw CSV string.
 * @returns An array of objects representing rows.
 */
export function parseCsv(csvText: string): CsvRow[] {
    const lines = csvText.trim().replace(/\r\n/g, '\n').split('\n');
    if (lines.length < 2) return [];

    const headerLine = lines.shift()!;
    // Simple split for header, assuming no quotes in header
    const headers = headerLine.split(',').map(h => h.trim());

    const rows: CsvRow[] = [];
    // This regex splits by comma, but ignores commas inside double quotes.
    const csvRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;

    for (const line of lines) {
        if (!line.trim()) continue;

        const values = line.split(csvRegex);
        if (values.length >= headers.length) {
            const row: Partial<CsvRow> = {};
            headers.forEach((header, index) => {
                if (values[index] !== undefined) {
                  let value = values[index].trim();
                  // Remove surrounding quotes, if they exist, and un-escape double-double-quotes
                  if (value.startsWith('"') && value.endsWith('"')) {
                      value = value.substring(1, value.length - 1).replace(/""/g, '"');
                  }
                  row[header as keyof CsvRow] = value;
                }
            });
            rows.push(row as CsvRow);
        }
    }
    return rows;
}


/**
 * Transforms parsed CSV data into the CombinedData structure needed for analysis.
 * @param csvData Array of parsed CSV rows.
 * @param username The username for the analysis.
 * @returns A CombinedData object.
 */
export function transformCsvToCombinedData(csvData: CsvRow[], username: string): CombinedData {
    const actionsData: UserAction[] = csvData.map(row => ({
        // All posts from archive are treated as replies (type 5) for simplicity.
        action_type: 5, 
        created_at: row.created_at,
        title: row.topic_title,
        excerpt: row.post_raw, // The prompt expects raw text.
        // target_username is not available in the CSV export.
    }));

    // Generate a synthetic summaryData object from the available post data.
    const post_count = csvData.length;
    const topic_titles = new Set(csvData.map(r => r.topic_title));
    const topic_count = topic_titles.size;
    const likes_received = csvData.reduce((sum, row) => sum + (parseInt(row.like_count, 10) || 0), 0);
    
    const categoryCounts: { [key: string]: number } = {};
    csvData.forEach(row => {
        if(!row.categories) return;
        // Handles "搞七捻三|搞七捻三, Lv1" and "搞七捻三" formats
        const mainCategories = row.categories.split('|')[0];
        const cats = mainCategories.split(',').map(c => c.trim());
        cats.forEach(cat => {
            if (cat) {
                categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
            }
        });
    });

    const top_categories = Object.entries(categoryCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5) // Get top 5 categories
        .map(([name, count]) => ({ name: name, post_count: count }));

    const topicsMap: { [key: string]: { like_count: number; posts_count: number } } = {};
    csvData.forEach(row => {
        if (!topicsMap[row.topic_title]) {
            topicsMap[row.topic_title] = { like_count: 0, posts_count: 0 };
        }
        // Sum likes from user's posts within a topic
        topicsMap[row.topic_title].like_count += parseInt(row.like_count, 10) || 0;
        // Get the max reply_count for the topic
        topicsMap[row.topic_title].posts_count = Math.max(
            topicsMap[row.topic_title].posts_count, 
            parseInt(row.reply_count, 10) || 0
        );
    });
    
    const topics = Object.entries(topicsMap)
      .map(([title, data]) => ({
        title,
        like_count: data.like_count,
        posts_count: data.posts_count,
      }))
      .sort((a, b) => b.like_count - a.like_count)
      .slice(0, 10); // Get top 10 participated topics

    const summaryData: UserSummaryData = {
        user_summary: {
            topic_count,
            post_count,
            likes_received,
            likes_given: 0,       // Not available in CSV
            days_visited: 0,      // Not available in CSV
            time_read: 0,         // Not available in CSV
            top_categories
        },
        topics,
        badges: [] // Not available in CSV
    };

    return {
        username,
        summaryData,
        actionsData
    };
}