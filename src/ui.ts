import * as p from '@clack/prompts';
import chalk from 'chalk';

export async function selectTransactionToEvaluate(transactions: any[]): Promise<any> {
    if (transactions.length === 0) {
        p.note('No uncategorized transactions found.', 'Info');
        return null;
    }

    const options = transactions.map((t) => ({
        value: t,
        label: `${t.date} | ${chalk.bold(t.payee_name || 'Unknown')} | ${chalk.green('$' + (t.amount / 1000).toFixed(2))}`,
    }));

    options.push({
        value: 'ALL',
        label: chalk.yellow('Evaluate All (Batch Mode)'),
    });
    
    options.push({
        value: 'MANAGE_AMBIGUOUS',
        label: chalk.magenta('Manage Ambiguous Payees'),
    });

    options.push({
        value: 'EXIT',
        label: chalk.dim('Exit'),
    });

    const selected = await p.select({
        message: 'Select a transaction to evaluate manually:',
        options: options,
    });

    if (p.isCancel(selected) || selected === 'EXIT') {
        p.cancel('Operation cancelled.');
        process.exit(0);
    }

    return selected;
}

export function displayEvaluationResult(transaction: any, stage: string, result: string, extraDetails?: string) {
    p.outro(chalk.cyan(`Evaluation Complete for ${chalk.bold(transaction.payee_name || 'Unknown')}!`));
    
    let content = `Stage: ${chalk.bold.blue(stage)}\nResult: ${chalk.bold.green(result)}`;
    if (extraDetails) {
        content += `\n\n${chalk.dim(extraDetails)}`;
    }
    
    p.note(content, 'Evaluation Result');
}