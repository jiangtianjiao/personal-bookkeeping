import { Express, Request, Response } from 'express';

const API_DOCS_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Personal Bookkeeping API Documentation</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; color: #333; line-height: 1.6; }
    .container { max-width: 960px; margin: 0 auto; padding: 24px; }
    h1 { font-size: 28px; margin-bottom: 8px; color: #1a1a1a; }
    .subtitle { color: #666; margin-bottom: 32px; }
    .section { background: #fff; border-radius: 8px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); overflow: hidden; }
    .section-header { padding: 16px 20px; background: #fafafa; border-bottom: 1px solid #eee; cursor: pointer; display: flex; justify-content: space-between; align-items: center; }
    .section-header h2 { font-size: 18px; color: #1a1a1a; }
    .section-header .badge { font-size: 12px; padding: 2px 8px; border-radius: 10px; background: #e8e8e8; color: #666; }
    .endpoints { padding: 0; }
    .endpoint { padding: 12px 20px; border-bottom: 1px solid #f0f0f0; display: flex; align-items: flex-start; gap: 12px; }
    .endpoint:last-child { border-bottom: none; }
    .method { font-size: 12px; font-weight: 700; padding: 2px 8px; border-radius: 4px; min-width: 60px; text-align: center; flex-shrink: 0; margin-top: 2px; }
    .method.get { background: #e7f5e7; color: #1b7a1b; }
    .method.post { background: #e7ecf5; color: #1b3d7a; }
    .method.put { background: #f5f0e7; color: #7a5e1b; }
    .method.delete { background: #f5e7e7; color: #7a1b1b; }
    .method.patch { background: #f0e7f5; color: #5e1b7a; }
    .ep-info { flex: 1; }
    .ep-path { font-family: 'SF Mono', Monaco, monospace; font-size: 14px; color: #1a1a1a; }
    .ep-desc { font-size: 13px; color: #888; margin-top: 2px; }
    .auth-badge { font-size: 11px; padding: 1px 6px; border-radius: 3px; background: #fff3e0; color: #e65100; margin-left: 8px; }
    .no-auth { background: #e8f5e9; color: #2e7d32; }
    footer { text-align: center; color: #999; font-size: 13px; margin-top: 32px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Personal Bookkeeping API</h1>
    <p class="subtitle">v1.0.0 &mdash; Base URL: <code>/api</code></p>

    <div class="section">
      <div class="section-header">
        <h2>Auth</h2>
        <span class="badge">/api/auth</span>
      </div>
      <div class="endpoints">
        <div class="endpoint">
          <span class="method post">POST</span>
          <div class="ep-info">
            <div class="ep-path">/api/auth/register <span class="auth-badge no-auth">Public</span></div>
            <div class="ep-desc">Register a new user. Body: { username, email, password }</div>
          </div>
        </div>
        <div class="endpoint">
          <span class="method post">POST</span>
          <div class="ep-info">
            <div class="ep-path">/api/auth/login <span class="auth-badge no-auth">Public</span></div>
            <div class="ep-desc">Login and get JWT token. Body: { email, password }</div>
          </div>
        </div>
        <div class="endpoint">
          <span class="method get">GET</span>
          <div class="ep-info">
            <div class="ep-path">/api/auth/profile <span class="auth-badge">Auth</span></div>
            <div class="ep-desc">Get current user profile</div>
          </div>
        </div>
        <div class="endpoint">
          <span class="method put">PUT</span>
          <div class="ep-info">
            <div class="ep-path">/api/auth/profile <span class="auth-badge">Auth</span></div>
            <div class="ep-desc">Update current user profile</div>
          </div>
        </div>
        <div class="endpoint">
          <span class="method put">PUT</span>
          <div class="ep-info">
            <div class="ep-path">/api/auth/change-password <span class="auth-badge">Auth</span></div>
            <div class="ep-desc">Change password. Body: { currentPassword, newPassword }</div>
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <h2>Accounts</h2>
        <span class="badge">/api/accounts</span>
      </div>
      <div class="endpoints">
        <div class="endpoint">
          <span class="method get">GET</span>
          <div class="ep-info">
            <div class="ep-path">/api/accounts <span class="auth-badge">Auth</span></div>
            <div class="ep-desc">List all accounts for the current user</div>
          </div>
        </div>
        <div class="endpoint">
          <span class="method get">GET</span>
          <div class="ep-info">
            <div class="ep-path">/api/accounts/:id <span class="auth-badge">Auth</span></div>
            <div class="ep-desc">Get account by ID</div>
          </div>
        </div>
        <div class="endpoint">
          <span class="method get">GET</span>
          <div class="ep-info">
            <div class="ep-path">/api/accounts/:id/balance <span class="auth-badge">Auth</span></div>
            <div class="ep-desc">Get account balance</div>
          </div>
        </div>
        <div class="endpoint">
          <span class="method post">POST</span>
          <div class="ep-info">
            <div class="ep-path">/api/accounts <span class="auth-badge">Auth</span></div>
            <div class="ep-desc">Create a new account. Body: { name, accountType, subtype?, icon?, currency?, parentId? }</div>
          </div>
        </div>
        <div class="endpoint">
          <span class="method put">PUT</span>
          <div class="ep-info">
            <div class="ep-path">/api/accounts/:id <span class="auth-badge">Auth</span></div>
            <div class="ep-desc">Update an account</div>
          </div>
        </div>
        <div class="endpoint">
          <span class="method delete">DELETE</span>
          <div class="ep-info">
            <div class="ep-path">/api/accounts/:id <span class="auth-badge">Auth</span></div>
            <div class="ep-desc">Delete an account</div>
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <h2>Transactions</h2>
        <span class="badge">/api/transactions</span>
      </div>
      <div class="endpoints">
        <div class="endpoint">
          <span class="method get">GET</span>
          <div class="ep-info">
            <div class="ep-path">/api/transactions <span class="auth-badge">Auth</span></div>
            <div class="ep-desc">List transactions with pagination and filters</div>
          </div>
        </div>
        <div class="endpoint">
          <span class="method get">GET</span>
          <div class="ep-info">
            <div class="ep-path">/api/transactions/:id <span class="auth-badge">Auth</span></div>
            <div class="ep-desc">Get transaction by ID</div>
          </div>
        </div>
        <div class="endpoint">
          <span class="method post">POST</span>
          <div class="ep-info">
            <div class="ep-path">/api/transactions/quick <span class="auth-badge">Auth</span></div>
            <div class="ep-desc">Quick entry (simplified). Body: { type, amount, accountId, categoryId?, description?, date? }</div>
          </div>
        </div>
        <div class="endpoint">
          <span class="method post">POST</span>
          <div class="ep-info">
            <div class="ep-path">/api/transactions/manual <span class="auth-badge">Auth</span></div>
            <div class="ep-desc">Manual double-entry transaction. Body: { entries: [...], description?, categoryId?, date? }</div>
          </div>
        </div>
        <div class="endpoint">
          <span class="method put">PUT</span>
          <div class="ep-info">
            <div class="ep-path">/api/transactions/:id <span class="auth-badge">Auth</span></div>
            <div class="ep-desc">Update a transaction</div>
          </div>
        </div>
        <div class="endpoint">
          <span class="method put">PUT</span>
          <div class="ep-info">
            <div class="ep-path">/api/transactions/:id/void <span class="auth-badge">Auth</span></div>
            <div class="ep-desc">Void a transaction (set status to void)</div>
          </div>
        </div>
        <div class="endpoint">
          <span class="method delete">DELETE</span>
          <div class="ep-info">
            <div class="ep-path">/api/transactions/:id <span class="auth-badge">Auth</span></div>
            <div class="ep-desc">Delete a transaction</div>
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <h2>Categories</h2>
        <span class="badge">/api/categories</span>
      </div>
      <div class="endpoints">
        <div class="endpoint">
          <span class="method get">GET</span>
          <div class="ep-info">
            <div class="ep-path">/api/categories <span class="auth-badge">Auth</span></div>
            <div class="ep-desc">List all categories</div>
          </div>
        </div>
        <div class="endpoint">
          <span class="method get">GET</span>
          <div class="ep-info">
            <div class="ep-path">/api/categories/:id <span class="auth-badge">Auth</span></div>
            <div class="ep-desc">Get category by ID</div>
          </div>
        </div>
        <div class="endpoint">
          <span class="method post">POST</span>
          <div class="ep-info">
            <div class="ep-path">/api/categories <span class="auth-badge">Auth</span></div>
            <div class="ep-desc">Create a category. Body: { name, type, icon?, sortOrder? }</div>
          </div>
        </div>
        <div class="endpoint">
          <span class="method put">PUT</span>
          <div class="ep-info">
            <div class="ep-path">/api/categories/:id <span class="auth-badge">Auth</span></div>
            <div class="ep-desc">Update a category</div>
          </div>
        </div>
        <div class="endpoint">
          <span class="method delete">DELETE</span>
          <div class="ep-info">
            <div class="ep-path">/api/categories/:id <span class="auth-badge">Auth</span></div>
            <div class="ep-desc">Delete a category</div>
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <h2>Tags</h2>
        <span class="badge">/api/tags</span>
      </div>
      <div class="endpoints">
        <div class="endpoint">
          <span class="method get">GET</span>
          <div class="ep-info">
            <div class="ep-path">/api/tags <span class="auth-badge">Auth</span></div>
            <div class="ep-desc">List all tags</div>
          </div>
        </div>
        <div class="endpoint">
          <span class="method post">POST</span>
          <div class="ep-info">
            <div class="ep-path">/api/tags <span class="auth-badge">Auth</span></div>
            <div class="ep-desc">Create a tag. Body: { name, color? }</div>
          </div>
        </div>
        <div class="endpoint">
          <span class="method put">PUT</span>
          <div class="ep-info">
            <div class="ep-path">/api/tags/:id <span class="auth-badge">Auth</span></div>
            <div class="ep-desc">Update a tag</div>
          </div>
        </div>
        <div class="endpoint">
          <span class="method delete">DELETE</span>
          <div class="ep-info">
            <div class="ep-path">/api/tags/:id <span class="auth-badge">Auth</span></div>
            <div class="ep-desc">Delete a tag</div>
          </div>
        </div>
        <div class="endpoint">
          <span class="method post">POST</span>
          <div class="ep-info">
            <div class="ep-path">/api/tags/transaction/:transactionId <span class="auth-badge">Auth</span></div>
            <div class="ep-desc">Add tags to a transaction. Body: { tagIds: string[] }</div>
          </div>
        </div>
        <div class="endpoint">
          <span class="method delete">DELETE</span>
          <div class="ep-info">
            <div class="ep-path">/api/tags/transaction/:transactionId/:tagId <span class="auth-badge">Auth</span></div>
            <div class="ep-desc">Remove a tag from a transaction</div>
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <h2>Rules</h2>
        <span class="badge">/api/rules</span>
      </div>
      <div class="endpoints">
        <div class="endpoint">
          <span class="method get">GET</span>
          <div class="ep-info">
            <div class="ep-path">/api/rules <span class="auth-badge">Auth</span></div>
            <div class="ep-desc">List all rules</div>
          </div>
        </div>
        <div class="endpoint">
          <span class="method post">POST</span>
          <div class="ep-info">
            <div class="ep-path">/api/rules <span class="auth-badge">Auth</span></div>
            <div class="ep-desc">Create a rule. Body: { title, triggers: [...], actions: [...], strictMode? }</div>
          </div>
        </div>
        <div class="endpoint">
          <span class="method put">PUT</span>
          <div class="ep-info">
            <div class="ep-path">/api/rules/:id <span class="auth-badge">Auth</span></div>
            <div class="ep-desc">Update a rule</div>
          </div>
        </div>
        <div class="endpoint">
          <span class="method delete">DELETE</span>
          <div class="ep-info">
            <div class="ep-path">/api/rules/:id <span class="auth-badge">Auth</span></div>
            <div class="ep-desc">Delete a rule</div>
          </div>
        </div>
        <div class="endpoint">
          <span class="method post">POST</span>
          <div class="ep-info">
            <div class="ep-path">/api/rules/apply/:transactionId <span class="auth-badge">Auth</span></div>
            <div class="ep-desc">Apply rules to a specific transaction</div>
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <h2>Recurring Transactions</h2>
        <span class="badge">/api/recurring</span>
      </div>
      <div class="endpoints">
        <div class="endpoint">
          <span class="method get">GET</span>
          <div class="ep-info">
            <div class="ep-path">/api/recurring <span class="auth-badge">Auth</span></div>
            <div class="ep-desc">List all recurring transactions</div>
          </div>
        </div>
        <div class="endpoint">
          <span class="method post">POST</span>
          <div class="ep-info">
            <div class="ep-path">/api/recurring <span class="auth-badge">Auth</span></div>
            <div class="ep-desc">Create a recurring transaction. Body: { title, repeatFreq, repeatInterval?, startDate, endDate?, templateData }</div>
          </div>
        </div>
        <div class="endpoint">
          <span class="method put">PUT</span>
          <div class="ep-info">
            <div class="ep-path">/api/recurring/:id <span class="auth-badge">Auth</span></div>
            <div class="ep-desc">Update a recurring transaction</div>
          </div>
        </div>
        <div class="endpoint">
          <span class="method delete">DELETE</span>
          <div class="ep-info">
            <div class="ep-path">/api/recurring/:id <span class="auth-badge">Auth</span></div>
            <div class="ep-desc">Delete a recurring transaction</div>
          </div>
        </div>
        <div class="endpoint">
          <span class="method post">POST</span>
          <div class="ep-info">
            <div class="ep-path">/api/recurring/process <span class="auth-badge">Auth</span></div>
            <div class="ep-desc">Process all due recurring transactions</div>
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <h2>Budgets</h2>
        <span class="badge">/api/budgets</span>
      </div>
      <div class="endpoints">
        <div class="endpoint">
          <span class="method get">GET</span>
          <div class="ep-info">
            <div class="ep-path">/api/budgets <span class="auth-badge">Auth</span></div>
            <div class="ep-desc">List all budgets</div>
          </div>
        </div>
        <div class="endpoint">
          <span class="method post">POST</span>
          <div class="ep-info">
            <div class="ep-path">/api/budgets <span class="auth-badge">Auth</span></div>
            <div class="ep-desc">Create a budget. Body: { name, categoryId? }</div>
          </div>
        </div>
        <div class="endpoint">
          <span class="method post">POST</span>
          <div class="ep-info">
            <div class="ep-path">/api/budgets/:id/limits <span class="auth-badge">Auth</span></div>
            <div class="ep-desc">Add a budget limit. Body: { amount, currency?, startDate, endDate }</div>
          </div>
        </div>
        <div class="endpoint">
          <span class="method get">GET</span>
          <div class="ep-info">
            <div class="ep-path">/api/budgets/:id/status <span class="auth-badge">Auth</span></div>
            <div class="ep-desc">Get budget status with spending progress</div>
          </div>
        </div>
        <div class="endpoint">
          <span class="method delete">DELETE</span>
          <div class="ep-info">
            <div class="ep-path">/api/budgets/:id <span class="auth-badge">Auth</span></div>
            <div class="ep-desc">Delete a budget</div>
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <h2>Reports</h2>
        <span class="badge">/api/reports</span>
      </div>
      <div class="endpoints">
        <div class="endpoint">
          <span class="method get">GET</span>
          <div class="ep-info">
            <div class="ep-path">/api/reports/balance-sheet <span class="auth-badge">Auth</span></div>
            <div class="ep-desc">Get balance sheet report. Query: { date? }</div>
          </div>
        </div>
        <div class="endpoint">
          <span class="method get">GET</span>
          <div class="ep-info">
            <div class="ep-path">/api/reports/income-expense <span class="auth-badge">Auth</span></div>
            <div class="ep-desc">Get income/expense report. Query: { startDate, endDate }</div>
          </div>
        </div>
        <div class="endpoint">
          <span class="method get">GET</span>
          <div class="ep-info">
            <div class="ep-path">/api/reports/trial-balance <span class="auth-badge">Auth</span></div>
            <div class="ep-desc">Get trial balance report</div>
          </div>
        </div>
        <div class="endpoint">
          <span class="method get">GET</span>
          <div class="ep-info">
            <div class="ep-path">/api/reports/dashboard <span class="auth-badge">Auth</span></div>
            <div class="ep-desc">Get dashboard summary data</div>
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <h2>Import / Export</h2>
        <span class="badge">/api</span>
      </div>
      <div class="endpoints">
        <div class="endpoint">
          <span class="method post">POST</span>
          <div class="ep-info">
            <div class="ep-path">/api/import/upload <span class="auth-badge">Auth</span></div>
            <div class="ep-desc">Import transactions from CSV file. Multipart form: file (CSV)</div>
          </div>
        </div>
        <div class="endpoint">
          <span class="method get">GET</span>
          <div class="ep-info">
            <div class="ep-path">/api/export <span class="auth-badge">Auth</span></div>
            <div class="ep-desc">Export transactions as CSV. Query: { startDate?, endDate? }</div>
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <h2>System</h2>
        <span class="badge">/</span>
      </div>
      <div class="endpoints">
        <div class="endpoint">
          <span class="method get">GET</span>
          <div class="ep-info">
            <div class="ep-path">/health <span class="auth-badge no-auth">Public</span></div>
            <div class="ep-desc">Health check endpoint. Returns status, uptime, version, database status</div>
          </div>
        </div>
        <div class="endpoint">
          <span class="method get">GET</span>
          <div class="ep-info">
            <div class="ep-path">/api <span class="auth-badge no-auth">Public</span></div>
            <div class="ep-desc">API info with list of available endpoints</div>
          </div>
        </div>
        <div class="endpoint">
          <span class="method get">GET</span>
          <div class="ep-info">
            <div class="ep-path">/api/docs <span class="auth-badge no-auth">Public</span></div>
            <div class="ep-desc">This API documentation page</div>
          </div>
        </div>
      </div>
    </div>

    <footer>
      <p>Personal Bookkeeping API v1.0.0</p>
    </footer>
  </div>
</body>
</html>`;

export const setupApiDocs = (app: Express): void => {
  app.get('/api/docs', (_req: Request, res: Response) => {
    res.type('html').send(API_DOCS_HTML);
  });
};
