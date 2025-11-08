/**
 * Format SQL query for better readability
 */
export function formatSQL(sql: string): string {
  if (!sql) return '';

  // Remove extra whitespace
  let formatted = sql.trim().replace(/\s+/g, ' ');

  // Keywords that should be on new lines
  const keywords = [
    'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'HAVING', 
    'ORDER BY', 'LIMIT', 'OFFSET', 'JOIN', 'LEFT JOIN', 
    'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN', 'UNION',
    'INSERT INTO', 'UPDATE', 'DELETE FROM', 'SET'
  ];

  // Add line breaks before keywords
  keywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    formatted = formatted.replace(regex, `\n${keyword}`);
  });

  // Add indentation
  const lines = formatted.split('\n').map(line => line.trim());
  const indented = lines.map((line, index) => {
    if (index === 0) return line;
    
    // Add indentation for non-main clauses
    const mainClauses = ['SELECT', 'FROM', 'WHERE', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT', 'OFFSET', 'UNION', 'INSERT', 'UPDATE', 'DELETE'];
    const isMainClause = mainClauses.some(clause => 
      line.toUpperCase().startsWith(clause)
    );
    
    return isMainClause ? line : `  ${line}`;
  });

  // Format SELECT columns
  formatted = indented.join('\n').replace(
    /SELECT\s+(.+?)\s+FROM/is,
    (match, columns) => {
      const cols = columns.split(',').map((col: string) => col.trim());
      if (cols.length > 3) {
        return `SELECT\n  ${cols.join(',\n  ')}\nFROM`;
      }
      return match;
    }
  );

  return formatted.trim();
}

/**
 * Minify SQL query (remove formatting)
 */
export function minifySQL(sql: string): string {
  return sql.trim().replace(/\s+/g, ' ');
}
