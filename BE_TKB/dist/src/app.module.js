"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const prisma_module_1 = require("./prisma/prisma.module");
const system_module_1 = require("./system/system.module");
const resources_module_1 = require("./resources/resources.module");
const users_module_1 = require("./users/users.module");
const organization_module_1 = require("./organization/organization.module");
const assignments_module_1 = require("./assignments/assignments.module");
const timetables_module_1 = require("./timetables/timetables.module");
const algorithm_module_1 = require("./algorithm/algorithm.module");
const bullmq_1 = require("@nestjs/bullmq");
const worker_module_1 = require("./worker/worker.module");
const auth_module_1 = require("./auth/auth.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            prisma_module_1.PrismaModule,
            bullmq_1.BullModule.forRoot({
                connection: {
                    host: process.env.REDIS_HOST || 'localhost',
                    port: parseInt(process.env.REDIS_PORT || '6379'),
                },
            }),
            system_module_1.SystemModule,
            resources_module_1.ResourcesModule,
            users_module_1.UsersModule,
            organization_module_1.OrganizationModule,
            assignments_module_1.AssignmentsModule,
            timetables_module_1.TimetablesModule,
            timetables_module_1.TimetablesModule,
            algorithm_module_1.AlgorithmModule,
            worker_module_1.WorkerModule,
            auth_module_1.AuthModule
        ],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map