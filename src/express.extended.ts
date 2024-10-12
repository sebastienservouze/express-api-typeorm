import {Container, Type} from "@nerisma/di";
import {DataSource, DataSourceOptions} from "typeorm";
import express from "express";
import {ControllerMetadataKeys} from "./controller/controller-metadata-keys.enum";
import {Endpoint} from "./controller/endpoint.model";

declare module 'express' {
    export interface Application {
        /**
         * Initialize the datasource and inject it into the container.
         * <br>
         * **Note:** If no `dataSourceOptions` are provided, it will default to an in-memory SQLite database.
         * <br>
         * **Note:** Provided `dataSourceOptions.entities` will be merged with the `entities` parameter.
         * @param dataSourceOptions
         */
        useDataSource(dataSourceOptions?: DataSourceOptions): Promise<void>;

        /**
         * Resolve and bind the controllers routes to the express application
         * @param controllers
         */
        useControllers(controllers: Type<any>[]): void;

        /**
         * Resolve and bind the controller routes to the express application
         * @param controller
         */
        useController(controller: Type<any>): void;
    }
}

export function expressExtended(): express.Application {
    const app = express() as unknown as express.Application;

    app.useDataSource = async function (dataSourceOptions?: DataSourceOptions): Promise<void> {
        if (!dataSourceOptions) {
            dataSourceOptions = {
                type: 'sqlite',
                database: ':memory:',
                synchronize: true,
                entities: [__dirname + '/**/*.entity{.ts,.js}'],
            };
        }

        const dataSource = await new DataSource(dataSourceOptions).initialize();
        Container.inject(dataSource, true);
    }

    app.useControllers = function (controllers: Type<any>[]): void {
        controllers.forEach(controller => this.useController(controller));
    };

    app.useController = function (controller: Type<any>): void {
        const basePath = Reflect.getMetadata(ControllerMetadataKeys.BASE_PATH, controller);
        const endpoints = Reflect.getMetadata(ControllerMetadataKeys.ENDPOINTS, controller) || [];

        if (!basePath) {
            throw new Error(`Base path not defined for controller: ${controller.name}`);
        }

        const instance = Container.resolve(controller);
        endpoints.forEach((endpoint: Endpoint) => {
            const path = `${basePath}${endpoint.path}`;
            app[endpoint.verb.toLowerCase() as keyof express.Application](path, endpoint.handler.bind(instance));
        });
    }

    return app;
}

export default expressExtended;