import {Container, Type} from "@nerisma/di";
import {DataSource, DataSourceOptions} from "typeorm";
import express from "express";
import {ControllerMetadataKeys} from "./web/ControllerMetadataKeys.enum";
import {Endpoint} from "./web/Endpoint.interface";

declare module 'express' {
    export interface Application {
        /**
         * Initialize the datasource and inject it into the container.
         * @param dataSourceOptions
         */
        useDataSource(dataSourceOptions?: DataSourceOptions): Promise<DataSource>;

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
    app.use(express.json());
    app.use(express.urlencoded({extended: true}));

    app.useDataSource = async function (dataSourceOptions: DataSourceOptions): Promise<DataSource> {
        const dataSource = await new DataSource(dataSourceOptions).initialize();
        Container.inject(dataSource, true);
        return dataSource;
    }

    app.useController = function (controller: Type<any>): Endpoint[] {
        const basePath = Reflect.getMetadata(ControllerMetadataKeys.BASE_PATH, controller);
        const endpoints = Reflect.getMetadata(ControllerMetadataKeys.ENDPOINTS, controller) || [];

        if (!basePath) {
            throw new Error(`Base path not defined for controller: ${controller.name}`);
        }

        const instance = Container.resolve(controller);
        endpoints.forEach((endpoint: Endpoint) => {
            const path = `${basePath}${endpoint.path}`;
            const method = endpoint.verb.toLowerCase() as keyof express.Application;

            app[method](path, endpoint.handler.bind(instance));
        });

        return endpoints;
    }

    app.useControllers = function (controllers: Type<any>[]): void {
        controllers.forEach(controller => this.useController(controller));
    };

    return app;
}

export default expressExtended;