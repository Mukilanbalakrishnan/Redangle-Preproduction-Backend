const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src/controllers');

function fixFile(file) {
    const filePath = path.join(dir, file);
    if (!fs.existsSync(filePath)) return;
    let code = fs.readFileSync(filePath, 'utf8');
    
    // Replace Number(req.params.leadId) -> String(req.params.leadId)
    code = code.replace(/Number\(req\.params\.leadId\)/g, "String(req.params.leadId)");
    // Replace Number(external_lead_id) -> String(external_lead_id)
    code = code.replace(/Number\(external_lead_id\)/g, "String(external_lead_id)");

    fs.writeFileSync(filePath, code);
}

const files = [
    'stageTracking.controller.ts',
    'eventDetails.controller.ts',
    'creativeConfirmation.controller.ts',
    'creativePlanning.controller.ts',
    'assignTeam.controller.ts',
    'photoUpload.controller.ts',
    'dataManager.controller.ts'
];

for (const f of files) {
    fixFile(f);
}

// In the services/queries, we need to make sure the type is string or any instead of number.
const typeFixes = [
    { file: 'src/services/eventDetails.service.ts', from: 'externalLeadId: number', to: 'externalLeadId: string' },
    { file: 'src/queries/eventDetails.query.ts', from: 'leadId: number', to: 'leadId: string' },
    { file: 'src/services/creativeConfirmation.service.ts', from: 'externalLeadId: number', to: 'externalLeadId: string' },
    { file: 'src/queries/creativeConfirmation.query.ts', from: 'externalLeadId: number', to: 'externalLeadId: string' },
    { file: 'src/services/creativePlanning.service.ts', from: 'externalLeadId: number', to: 'externalLeadId: string' },
    { file: 'src/queries/creativePlanning.query.ts', from: 'parent_lead_id: number', to: 'parent_lead_id: string' },
    { file: 'src/services/assignTeam.service.ts', from: 'externalLeadId: number', to: 'externalLeadId: string' },
    { file: 'src/queries/assignTeam.query.ts', from: 'external_lead_id: number', to: 'external_lead_id: string' },
    { file: 'src/services/stageTracking.service.ts', from: 'externalLeadId: number', to: 'externalLeadId: string' },
    { file: 'src/queries/stageTracking.query.ts', from: 'externalLeadId: number', to: 'externalLeadId: string' }
];

for (const tf of typeFixes) {
    const fPath = path.join(__dirname, tf.file);
    if (fs.existsSync(fPath)) {
        let code = fs.readFileSync(fPath, 'utf8');
        code = code.replace(new RegExp(tf.from, 'g'), tf.to);
        fs.writeFileSync(fPath, code);
    }
}

console.log("Backend types migrated to string successfully.");
