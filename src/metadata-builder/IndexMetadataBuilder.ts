import {IndexMetadataArgs} from "../metadata-args/IndexMetadataArgs";
import {EntityMetadata} from "../metadata/EntityMetadata";

/**
 * Index metadata contains all information about table's index.
 */
export class IndexMetadataBuilder {

    // ---------------------------------------------------------------------
    // Public Properties
    // ---------------------------------------------------------------------

    /**
     * Entity metadata of the class to which this index is applied.
     */
    entityMetadata: EntityMetadata;

    // ---------------------------------------------------------------------
    // Readonly Properties
    // ---------------------------------------------------------------------

    /**
     * Indicates if this index must be unique.
     */
    readonly isUnique: boolean;

    /**
     * Target class to which metadata is applied.
     */
    readonly target?: Function|string;

    // ---------------------------------------------------------------------
    // Private Properties
    // ---------------------------------------------------------------------

    /**
     * Composite index name.
     */
    private readonly _name: string|undefined;

    /**
     * Columns combination to be used as index.
     */
    private readonly _columns: ((object?: any) => (any[]|{ [key: string]: number }))|string[];

    // ---------------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------------

    constructor(entityMetadata: EntityMetadata, args: IndexMetadataArgs) {
        this.entityMetadata = entityMetadata;
        this.target = args.target;
        // this._columns = args.columns;
        this._name = args.name;
        this.isUnique = args.unique;
    }

    // ---------------------------------------------------------------------
    // Accessors
    // ---------------------------------------------------------------------

    /**
     * Gets index's name.
     */
    get name() {
        return (this as any).namingStrategy.indexName(this._name, this.entityMetadata.tableName, this.columns);
    }

    /**
     * Gets the table name on which index is applied.
     */
    get tableName() {
        return this.entityMetadata.tableName;
    }

    /**
     * Gets the column names which are in this index.
     */
    get columns(): string[] {

        // if columns already an array of string then simply return it
        let columnPropertyNames: string[] = [];
        if (this._columns instanceof Array) {
            columnPropertyNames = this._columns;
        } else {
            // if columns is a function that returns array of field names then execute it and get columns names from it
            const columnsFnResult = this._columns(this.entityMetadata.propertiesMap);
            const columnsNamesFromFnResult = columnsFnResult instanceof Array ? columnsFnResult : Object.keys(columnsFnResult);
            columnPropertyNames = columnsNamesFromFnResult.map((i: any) => String(i));
        }

        const columns = this.entityMetadata.columns.filter(column => columnPropertyNames.indexOf(column.propertyPath) !== -1);
        this.entityMetadata.relations
            .filter(relation => relation.isWithJoinColumn && columnPropertyNames.indexOf(relation.propertyName) !== -1)
            .forEach(relation => columns.push(...relation.joinColumns));

        // todo: better to extract all validation into single place if possible
        const missingColumnNames = columnPropertyNames.filter(columnPropertyName => {
            return !this.entityMetadata.columns.find(column => column.propertyPath === columnPropertyName) &&
                !this.entityMetadata.relations.find(relation => relation.isWithJoinColumn && columnPropertyNames.indexOf(relation.propertyName) !== -1);
        });
        if (missingColumnNames.length > 0) {
            // console.log(this.entityMetadata.columns);
            throw new Error(`Index ${this._name ? "\"" + this._name + "\" " : ""}contains columns that are missing in the entity: ` + missingColumnNames.join(", "));
        }

        return columns.map(column => column.databaseName);
    }

    /**
     * Builds columns as a map of values where column name is key of object and value is a value provided by
     * function or default value given to this function.
     */
    buildColumnsAsMap(defaultValue = 0): { [key: string]: number } {

        const map: { [key: string]: number } = {};

        // if columns already an array of string then simply create a map from it
        if (this._columns instanceof Array) {
            this._columns.forEach(columnName => map[columnName] = defaultValue);

        } else {
            // if columns is a function that returns array of field names then execute it and get columns names from it
            const columnsFnResult = this._columns(this.entityMetadata.propertiesMap);
            if (columnsFnResult instanceof Array) {
                columnsFnResult.forEach(columnName => map[columnName] = defaultValue);
            } else {
                Object.keys(columnsFnResult).forEach(columnName => map[columnName] = columnsFnResult[columnName]);
            }
        }

        // replace each propertyNames with column names
        return Object.keys(map).reduce((updatedMap, key) => {
            const column = this.entityMetadata.columns.find(column => column.propertyName === key);
            if (!column)
                throw new Error(`Index ${this._name ? "\"" + this._name + "\" " : ""}contains columns that are missing in the entity: ${key}`);

            updatedMap[column.databaseName] = map[key];
            return updatedMap;
        }, {} as { [key: string]: number });
    }

}